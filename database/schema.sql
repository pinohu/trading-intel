create extension if not exists pgcrypto;

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rate_limit_buckets (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create index if not exists rate_limit_buckets_reset_at_idx
  on rate_limit_buckets (reset_at);

create table if not exists quote_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  price numeric(20, 6) not null,
  change numeric(20, 6) not null,
  change_pct numeric(12, 6) not null,
  open numeric(20, 6) not null,
  high numeric(20, 6) not null,
  low numeric(20, 6) not null,
  volume numeric(24, 0) not null,
  source text not null,
  quality text not null,
  provider text not null default 'auto',
  market_status text,
  provider_updated_at timestamptz,
  captured_at timestamptz not null default now()
);

create index if not exists quote_snapshots_symbol_captured_at_idx
  on quote_snapshots (symbol, captured_at desc);

create table if not exists signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_snapshot_id uuid references quote_snapshots(id) on delete set null,
  symbol text not null,
  action text not null,
  setup text not null,
  confidence integer not null,
  quality text not null,
  urgency text not null,
  price numeric(20, 6) not null,
  invalidation numeric(20, 6) not null,
  target numeric(20, 6) not null,
  reward_risk numeric(12, 6) not null,
  position_risk_pct numeric(8, 4) not null,
  reason text not null,
  warnings jsonb not null default '[]'::jsonb,
  confirmations jsonb not null default '[]'::jsonb,
  data_fresh boolean not null,
  data_age_minutes numeric(12, 4),
  generated_at timestamptz not null
);

create index if not exists signal_snapshots_symbol_generated_at_idx
  on signal_snapshots (symbol, generated_at desc);

create index if not exists signal_snapshots_action_generated_at_idx
  on signal_snapshots (action, generated_at desc);

create table if not exists trade_tickets (
  id uuid primary key default gen_random_uuid(),
  signal_snapshot_id uuid references signal_snapshots(id) on delete set null,
  symbol text not null,
  side text not null,
  status text not null,
  trigger numeric(20, 6),
  entry_signal_needed text,
  entry numeric(20, 6) not null,
  stop numeric(20, 6) not null,
  target numeric(20, 6) not null,
  units integer not null,
  notional numeric(20, 2) not null,
  potential_units integer,
  potential_notional numeric(20, 2),
  max_loss numeric(20, 2) not null,
  reward_risk numeric(12, 6) not null,
  risk_reward_ratio numeric(12, 6),
  risk_pct numeric(8, 4) not null,
  risk_budget_dollars numeric(20, 2),
  daily_loss_cap_dollars numeric(20, 2),
  unit_risk numeric(20, 6),
  position_size text,
  suggested_position_size text,
  tradeable boolean not null,
  reason text not null,
  must_confirm jsonb not null default '[]'::jsonb,
  do_not_trade_if jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists trade_tickets add column if not exists trigger numeric(20, 6);
alter table if exists trade_tickets add column if not exists entry_signal_needed text;
alter table if exists trade_tickets add column if not exists potential_units integer;
alter table if exists trade_tickets add column if not exists potential_notional numeric(20, 2);
alter table if exists trade_tickets add column if not exists risk_reward_ratio numeric(12, 6);
alter table if exists trade_tickets add column if not exists risk_budget_dollars numeric(20, 2);
alter table if exists trade_tickets add column if not exists daily_loss_cap_dollars numeric(20, 2);
alter table if exists trade_tickets add column if not exists unit_risk numeric(20, 6);
alter table if exists trade_tickets add column if not exists position_size text;
alter table if exists trade_tickets add column if not exists suggested_position_size text;

create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  trade_ticket_id uuid references trade_tickets(id) on delete set null,
  symbol text not null,
  side text not null,
  entry numeric(20, 6) not null,
  stop numeric(20, 6) not null,
  target numeric(20, 6) not null,
  units integer not null,
  max_loss numeric(20, 2) not null,
  status text not null default 'Watching',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  exit_price numeric(20, 6),
  realized_pnl numeric(20, 2),
  notes text
);

create index if not exists paper_trades_symbol_opened_at_idx
  on paper_trades (symbol, opened_at desc);

create table if not exists signal_outcomes (
  id uuid primary key default gen_random_uuid(),
  signal_snapshot_id uuid references signal_snapshots(id) on delete cascade,
  horizon text not null,
  observed_price numeric(20, 6) not null,
  return_pct numeric(12, 6) not null,
  hit_target boolean not null default false,
  hit_stop boolean not null default false,
  observed_at timestamptz not null default now(),
  unique (signal_snapshot_id, horizon)
);

create index if not exists signal_outcomes_observed_at_idx
  on signal_outcomes (observed_at desc);

create table if not exists fundamental_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  cik text,
  name text not null,
  source text not null,
  data_quality text not null,
  metrics jsonb not null default '{}'::jsonb,
  missing jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  provider_updated_at timestamptz,
  captured_at timestamptz not null default now()
);

alter table if exists fundamental_snapshots
  add column if not exists provenance jsonb not null default '{}'::jsonb;

create index if not exists fundamental_snapshots_symbol_captured_at_idx
  on fundamental_snapshots (symbol, captured_at desc);

create table if not exists factor_snapshots (
  id uuid primary key default gen_random_uuid(),
  fundamental_snapshot_id uuid references fundamental_snapshots(id) on delete set null,
  symbol text not null,
  recommendation text not null,
  ensemble_score integer not null,
  confidence integer not null,
  data_coverage_pct integer not null,
  model_version text not null,
  factor_scores jsonb not null default '[]'::jsonb,
  thesis text not null,
  bear_case text not null,
  risk_controls jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null
);

create index if not exists factor_snapshots_symbol_generated_at_idx
  on factor_snapshots (symbol, generated_at desc);

create table if not exists strategy_backtests (
  id uuid primary key default gen_random_uuid(),
  strategy text not null,
  symbols jsonb not null default '[]'::jsonb,
  timeframe text not null,
  lookback_days integer not null,
  assumptions jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  data_source text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists strategy_backtests_created_at_idx
  on strategy_backtests (created_at desc);

create table if not exists strategy_registry (
  id text not null,
  version text not null,
  name text not null,
  family text not null,
  description text not null,
  deployment_state text not null default 'research',
  risk_budget_pct numeric(8, 4) not null default 0,
  max_drawdown_limit_pct numeric(8, 4) not null default 0,
  promotion_criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version)
);

create table if not exists strategy_evaluations (
  id uuid primary key default gen_random_uuid(),
  strategy_id text not null,
  strategy_version text not null,
  state text not null,
  proof_score numeric(8, 4) not null,
  allocation_weight_pct numeric(8, 4) not null default 0,
  risk_budget_pct numeric(8, 4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  promotion_blockers jsonb not null default '[]'::jsonb,
  demotion_triggers jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now()
);

create index if not exists strategy_evaluations_strategy_evaluated_at_idx
  on strategy_evaluations (strategy_id, evaluated_at desc);

create table if not exists alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  symbol text,
  severity text not null,
  title text not null,
  message text not null,
  channels jsonb not null default '[]'::jsonb,
  delivery_results jsonb not null default '[]'::jsonb,
  source text not null default 'monitor',
  created_at timestamptz not null default now()
);

create index if not exists alert_events_created_at_idx
  on alert_events (created_at desc);

create table if not exists portfolio_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  equity numeric(20, 2),
  cash numeric(20, 2),
  buying_power numeric(20, 2),
  market_value numeric(20, 2),
  daily_pnl numeric(20, 2),
  daily_pnl_pct numeric(12, 6),
  gross_exposure numeric(20, 2),
  net_exposure numeric(20, 2),
  concentration jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  account jsonb not null default '{}'::jsonb,
  positions jsonb not null default '[]'::jsonb,
  orders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_risk_snapshots_created_at_idx
  on portfolio_risk_snapshots (created_at desc);

create table if not exists provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  ok boolean not null,
  latency_ms integer,
  detail text,
  checked_at timestamptz not null default now()
);

create index if not exists provider_health_provider_checked_at_idx
  on provider_health (provider, checked_at desc);

create table if not exists broker_order_requests (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  symbol text not null,
  side text not null,
  qty numeric(24, 8) not null,
  order_type text not null,
  limit_price numeric(20, 6),
  stop_price numeric(20, 6),
  time_in_force text not null,
  extended_hours boolean not null default false,
  max_notional numeric(20, 2),
  client_order_id text,
  status text not null,
  broker_order_id text,
  broker_status text,
  broker_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_order_requests_created_at_idx
  on broker_order_requests (created_at desc);

create index if not exists broker_order_requests_symbol_created_at_idx
  on broker_order_requests (symbol, created_at desc);

create table if not exists broker_order_events (
  id uuid primary key default gen_random_uuid(),
  broker_order_request_id uuid references broker_order_requests(id) on delete set null,
  mode text not null,
  broker_order_id text,
  client_order_id text,
  symbol text,
  event_type text not null,
  broker_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists broker_order_events_created_at_idx
  on broker_order_events (created_at desc);

create table if not exists control_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists model_validation_reports (
  id uuid primary key default gen_random_uuid(),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists model_validation_reports_created_at_idx
  on model_validation_reports (created_at desc);

create table if not exists catalyst_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  event_type text not null,
  title text not null,
  importance integer not null,
  source text not null,
  event_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists catalyst_events_symbol_captured_at_idx
  on catalyst_events (symbol, captured_at desc);

create table if not exists option_volatility_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  feed text not null,
  data_quality text not null,
  metrics jsonb not null default '{}'::jsonb,
  contracts jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists option_volatility_snapshots_symbol_captured_at_idx
  on option_volatility_snapshots (symbol, captured_at desc);

create table if not exists broker_reconciliations (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  orders_checked integer not null default 0,
  activities_checked integer not null default 0,
  events_inserted integer not null default 0,
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists broker_reconciliations_created_at_idx
  on broker_reconciliations (created_at desc);

create table if not exists research_notes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  note_type text not null default 'research',
  title text not null,
  body text not null,
  tags jsonb not null default '[]'::jsonb,
  source text not null default 'dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_notes_symbol_created_at_idx
  on research_notes (symbol, created_at desc);

create index if not exists research_notes_created_at_idx
  on research_notes (created_at desc);

create table if not exists autoresearch_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  mode text not null,
  symbols jsonb not null default '[]'::jsonb,
  budget integer not null,
  champion jsonb not null default '{}'::jsonb,
  experiments jsonb not null default '[]'::jsonb,
  guardrails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autoresearch_runs_created_at_idx
  on autoresearch_runs (created_at desc);
