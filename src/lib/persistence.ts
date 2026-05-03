import { databaseConfigured, getSql } from "@/lib/db";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";
import type { FundamentalSnapshot } from "@/lib/fundamentals";
import type { SignalQuote, TradeSignal } from "@/lib/signalEngine";
import type { TradeTicket } from "@/lib/tradeTicket";

export type PaperTradePayload = {
  symbol: string;
  side: "Buy" | "Sell / Avoid";
  entry: number;
  stop: number;
  target: number;
  units: number;
  maxLoss: number;
  status?: "Watching" | "Closed" | "Canceled";
  notes?: string;
};

export type DueSignalSnapshot = {
  id: string;
  symbol: string;
  action: TradeSignal["action"];
  price: number;
  invalidation: number;
  target: number;
  generated_at: string;
};

export type SignalOutcomePayload = {
  signalSnapshotId: string;
  horizon: string;
  observedPrice: number;
  returnPct: number;
  hitTarget: boolean;
  hitStop: boolean;
};

export type BacktestRunPayload = {
  strategy: string;
  symbols: string[];
  timeframe: string;
  lookbackDays: number;
  assumptions: Record<string, unknown>;
  metrics: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  dataSource: string;
  status: string;
};

export type AlertEventPayload = {
  alertType: string;
  symbol?: string | null;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  channels: string[];
  deliveryResults: Array<Record<string, unknown>>;
  source?: string;
};

export type PortfolioRiskSnapshotPayload = {
  mode: string;
  equity: number | null;
  cash: number | null;
  buyingPower: number | null;
  marketValue: number | null;
  dailyPnl: number | null;
  dailyPnlPct: number | null;
  grossExposure: number | null;
  netExposure: number | null;
  concentration: Array<Record<string, unknown>>;
  riskFlags: string[];
  account: Record<string, unknown> | null;
  positions: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
};

export type CatalystEventPayload = {
  symbol: string;
  eventType: string;
  title: string;
  importance: number;
  source: string;
  eventTime?: string | null;
  payload: Record<string, unknown>;
};

export type OptionVolatilitySnapshotPayload = {
  symbol: string;
  feed: string;
  dataQuality: string;
  metrics: Record<string, unknown>;
  contracts: Array<Record<string, unknown>>;
};

export type BrokerReconciliationPayload = {
  mode: string;
  ordersChecked: number;
  activitiesChecked: number;
  eventsInserted: number;
  status: string;
  summary: Record<string, unknown>;
};

export type ResearchNotePayload = {
  symbol: string;
  noteType?: string;
  title: string;
  body: string;
  tags?: string[];
  source?: string;
};

export type AutoResearchRunPayload = {
  runLabel: string;
  mode: string;
  symbols: string[];
  budget: number;
  champion: Record<string, unknown>;
  experiments: Array<Record<string, unknown>>;
  guardrails: string[];
};

export async function insertFundamentalSnapshot(snapshot: FundamentalSnapshot) {
  const sql = getSql();
  const rows = await sql`
    insert into fundamental_snapshots (
      symbol, cik, name, source, data_quality, metrics, missing, provenance, provider_updated_at
    )
    values (
      ${snapshot.symbol}, ${snapshot.cik}, ${snapshot.name}, ${snapshot.source},
      ${snapshot.dataQuality}, ${JSON.stringify(snapshot.metrics)}::jsonb,
      ${JSON.stringify(snapshot.missing)}::jsonb, ${JSON.stringify(snapshot.provenance)}::jsonb,
      ${safeIso(snapshot.updatedAt)}
    )
    returning id
  `;
  return String(rows[0].id);
}

export async function insertFactorSnapshot(score: AlgorithmCouncilScore, fundamentalSnapshotId: string | null = null) {
  const sql = getSql();
  const rows = await sql`
    insert into factor_snapshots (
      fundamental_snapshot_id, symbol, recommendation, ensemble_score, confidence,
      data_coverage_pct, model_version, factor_scores, thesis, bear_case, risk_controls,
      sources, generated_at
    )
    values (
      ${fundamentalSnapshotId}, ${score.symbol}, ${score.recommendation}, ${score.ensembleScore},
      ${score.confidence}, ${score.dataCoveragePct}, ${score.modelVersion},
      ${JSON.stringify(score.factorScores)}::jsonb, ${score.thesis}, ${score.bearCase},
      ${JSON.stringify(score.riskControls)}::jsonb, ${JSON.stringify(score.sources)}::jsonb,
      ${safeIso(score.generatedAt) ?? new Date().toISOString()}
    )
    returning id
  `;
  return String(rows[0].id);
}

export function validPaperTradePayload(payload: unknown): payload is PaperTradePayload {
  if (!payload || typeof payload !== "object") return false;
  const item = payload as Partial<PaperTradePayload>;
  const validStatus = !item.status || ["Watching", "Closed", "Canceled"].includes(item.status);
  const validNotes = !item.notes || (typeof item.notes === "string" && item.notes.length <= 1000);
  return (
    typeof item.symbol === "string" &&
    /^[A-Z0-9.=^-]{1,14}$/.test(item.symbol) &&
    (item.side === "Buy" || item.side === "Sell / Avoid") &&
    finitePositive(item.entry) &&
    finitePositive(item.stop) &&
    finitePositive(item.target) &&
    typeof item.units === "number" &&
    Number.isInteger(item.units) &&
    item.units > 0 &&
    typeof item.maxLoss === "number" &&
    Number.isFinite(item.maxLoss) &&
    item.maxLoss >= 0 &&
    validStatus &&
    validNotes
  );
}

export function validResearchNotePayload(payload: unknown): payload is ResearchNotePayload {
  if (!payload || typeof payload !== "object") return false;
  const item = payload as Partial<ResearchNotePayload>;
  const validTags = !item.tags || (Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === "string" && tag.length <= 40));
  return (
    typeof item.symbol === "string" &&
    /^[A-Z0-9.=^-]{1,14}$/.test(item.symbol.trim().toUpperCase()) &&
    (!item.noteType || /^[a-z0-9_-]{1,32}$/i.test(item.noteType)) &&
    typeof item.title === "string" &&
    item.title.trim().length >= 2 &&
    item.title.length <= 180 &&
    typeof item.body === "string" &&
    item.body.trim().length >= 2 &&
    item.body.length <= 5000 &&
    (!item.source || item.source.length <= 64) &&
    validTags
  );
}

export async function insertQuoteSnapshot(quote: SignalQuote, provider = "auto") {
  const sql = getSql();
  const rows = await sql`
    insert into quote_snapshots (
      symbol, name, price, change, change_pct, open, high, low, volume,
      source, quality, provider, market_status, provider_updated_at
    )
    values (
      ${quote.symbol}, ${quote.name}, ${quote.price}, ${quote.change}, ${quote.changePct},
      ${quote.open}, ${quote.high}, ${quote.low}, ${quote.volume}, ${quote.source},
      ${quote.quality ?? "Unknown"}, ${provider}, ${quote.marketStatus ?? null},
      ${safeIso(quote.updatedAt)}
    )
    returning id
  `;
  return String(rows[0].id);
}

export async function insertSignalSnapshot(signal: TradeSignal, quoteSnapshotId: string | null) {
  const sql = getSql();
  const rows = await sql`
    insert into signal_snapshots (
      quote_snapshot_id, symbol, action, setup, confidence, quality, urgency, price,
      invalidation, target, reward_risk, position_risk_pct, reason, warnings,
      confirmations, data_fresh, data_age_minutes, generated_at
    )
    values (
      ${quoteSnapshotId}, ${signal.symbol}, ${signal.action}, ${signal.setup}, ${signal.confidence},
      ${signal.quality}, ${signal.urgency}, ${signal.price}, ${signal.invalidation},
      ${signal.target}, ${signal.rewardRisk}, ${signal.positionRiskPct}, ${signal.reason},
      ${JSON.stringify(signal.warnings)}::jsonb, ${JSON.stringify(signal.confirmations)}::jsonb,
      ${signal.dataFresh}, ${signal.dataAgeMinutes}, ${safeIso(signal.generatedAt) ?? new Date().toISOString()}
    )
    returning id
  `;
  return String(rows[0].id);
}

export async function insertTradeTicket(ticket: TradeTicket, signalSnapshotId: string | null = null) {
  const sql = getSql();
  const rows = await sql`
    insert into trade_tickets (
      signal_snapshot_id, symbol, side, status, trigger, entry_signal_needed, entry, stop, target, units, notional,
      potential_units, potential_notional, max_loss, reward_risk, risk_reward_ratio, risk_pct,
      risk_budget_dollars, daily_loss_cap_dollars, unit_risk, position_size, suggested_position_size,
      tradeable, reason, must_confirm, do_not_trade_if
    )
    values (
      ${signalSnapshotId}, ${ticket.symbol}, ${ticket.side}, ${ticket.status}, ${ticket.trigger},
      ${ticket.entrySignalNeeded}, ${ticket.entry}, ${ticket.stop}, ${ticket.target}, ${ticket.units},
      ${ticket.notional}, ${ticket.potentialUnits}, ${ticket.potentialNotional}, ${ticket.maxLoss},
      ${ticket.rewardRisk}, ${ticket.riskRewardRatio}, ${ticket.riskPct}, ${ticket.riskBudgetDollars},
      ${ticket.dailyLossCapDollars}, ${ticket.unitRisk}, ${ticket.positionSize}, ${ticket.suggestedPositionSize},
      ${ticket.tradeable}, ${ticket.reason},
      ${JSON.stringify(ticket.mustConfirm)}::jsonb, ${JSON.stringify(ticket.doNotTradeIf)}::jsonb
    )
    returning id
  `;
  return String(rows[0].id);
}

export async function insertPaperTrade(payload: PaperTradePayload, tradeTicketId: string | null = null) {
  const sql = getSql();
  const rows = await sql`
    insert into paper_trades (
      trade_ticket_id, symbol, side, entry, stop, target, units, max_loss, status, notes
    )
    values (
      ${tradeTicketId}, ${payload.symbol}, ${payload.side}, ${payload.entry}, ${payload.stop},
      ${payload.target}, ${payload.units}, ${payload.maxLoss}, ${payload.status ?? "Watching"},
      ${payload.notes ?? null}
    )
    returning *
  `;
  return rows[0];
}

export async function listPaperTrades(limit = 50) {
  const sql = getSql();
  return sql`
    select *
    from paper_trades
    order by opened_at desc
    limit ${Math.max(1, Math.min(limit, 200))}
  `;
}

export async function listDueSignalSnapshots(horizon: string, horizonMinutes: number, limit = 100) {
  const sql = getSql();
  return sql<DueSignalSnapshot>`
    select
      id::text,
      symbol,
      action,
      price::float,
      invalidation::float,
      target::float,
      generated_at::text
    from signal_snapshots signal
    where signal.generated_at <= now() - (${horizonMinutes} || ' minutes')::interval
      and not exists (
        select 1
        from signal_outcomes outcome
        where outcome.signal_snapshot_id = signal.id
          and outcome.horizon = ${horizon}
      )
    order by signal.generated_at desc
    limit ${Math.max(1, Math.min(limit, 500))}
  `;
}

export async function insertSignalOutcome(payload: SignalOutcomePayload) {
  const sql = getSql();
  const rows = await sql`
    insert into signal_outcomes (
      signal_snapshot_id, horizon, observed_price, return_pct, hit_target, hit_stop
    )
    values (
      ${payload.signalSnapshotId}, ${payload.horizon}, ${payload.observedPrice}, ${payload.returnPct},
      ${payload.hitTarget}, ${payload.hitStop}
    )
    on conflict (signal_snapshot_id, horizon) do update
    set
      observed_price = excluded.observed_price,
      return_pct = excluded.return_pct,
      hit_target = excluded.hit_target,
      hit_stop = excluded.hit_stop,
      observed_at = now()
    returning *
  `;
  return rows[0];
}

export async function listSignalOutcomes(limit = 100) {
  const sql = getSql();
  return sql`
    select
      outcome.*,
      signal.symbol,
      signal.action,
      signal.price as entry_price,
      signal.target,
      signal.invalidation
    from signal_outcomes outcome
    join signal_snapshots signal on signal.id = outcome.signal_snapshot_id
    order by outcome.observed_at desc
    limit ${Math.max(1, Math.min(limit, 500))}
  `;
}

export async function insertStrategyBacktest(payload: BacktestRunPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into strategy_backtests (
      strategy, symbols, timeframe, lookback_days, assumptions, metrics, results, data_source, status
    )
    values (
      ${payload.strategy}, ${JSON.stringify(payload.symbols)}::jsonb, ${payload.timeframe},
      ${payload.lookbackDays}, ${JSON.stringify(payload.assumptions)}::jsonb,
      ${JSON.stringify(payload.metrics)}::jsonb, ${JSON.stringify(payload.results)}::jsonb,
      ${payload.dataSource}, ${payload.status}
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function listStrategyBacktests(limit = 25) {
  const sql = getSql();
  return sql`
    select *
    from strategy_backtests
    order by created_at desc
    limit ${Math.max(1, Math.min(limit, 100))}
  `;
}

export async function insertAlertEvent(payload: AlertEventPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into alert_events (
      alert_type, symbol, severity, title, message, channels, delivery_results, source
    )
    values (
      ${payload.alertType}, ${payload.symbol ?? null}, ${payload.severity}, ${payload.title},
      ${payload.message}, ${JSON.stringify(payload.channels)}::jsonb,
      ${JSON.stringify(payload.deliveryResults)}::jsonb, ${payload.source ?? "monitor"}
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function listAlertEvents(limit = 50) {
  const sql = getSql();
  return sql`
    select *
    from alert_events
    order by created_at desc
    limit ${Math.max(1, Math.min(limit, 200))}
  `;
}

export async function insertPortfolioRiskSnapshot(payload: PortfolioRiskSnapshotPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into portfolio_risk_snapshots (
      mode, equity, cash, buying_power, market_value, daily_pnl, daily_pnl_pct,
      gross_exposure, net_exposure, concentration, risk_flags, account, positions, orders
    )
    values (
      ${payload.mode}, ${payload.equity}, ${payload.cash}, ${payload.buyingPower}, ${payload.marketValue},
      ${payload.dailyPnl}, ${payload.dailyPnlPct}, ${payload.grossExposure}, ${payload.netExposure},
      ${JSON.stringify(payload.concentration)}::jsonb, ${JSON.stringify(payload.riskFlags)}::jsonb,
      ${JSON.stringify(payload.account ?? {})}::jsonb, ${JSON.stringify(payload.positions)}::jsonb,
      ${JSON.stringify(payload.orders)}::jsonb
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function listPortfolioRiskSnapshots(limit = 25) {
  const sql = getSql();
  return sql`
    select *
    from portfolio_risk_snapshots
    order by created_at desc
    limit ${Math.max(1, Math.min(limit, 100))}
  `;
}

export async function getControlValue<T extends Record<string, unknown>>(key: string) {
  const sql = getSql();
  const rows = await sql<{ value: T }>`
    select value
    from control_state
    where key = ${key}
    limit 1
  `;
  return rows[0]?.value ?? null;
}

export async function upsertControlValue(key: string, value: Record<string, unknown>) {
  const sql = getSql();
  const rows = await sql`
    insert into control_state (key, value, updated_at)
    values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_at = now()
    returning key, value, updated_at::text
  `;
  return rows[0];
}

export async function insertModelValidationReport(report: Record<string, unknown>) {
  const sql = getSql();
  const rows = await sql`
    insert into model_validation_reports (report)
    values (${JSON.stringify(report)}::jsonb)
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function listModelValidationReports(limit = 25) {
  const sql = getSql();
  return sql`
    select id::text, report, created_at::text
    from model_validation_reports
    order by created_at desc
    limit ${Math.max(1, Math.min(limit, 100))}
  `;
}

export async function insertCatalystEvents(events: CatalystEventPayload[]) {
  if (events.length === 0) return [];
  const sql = getSql();
  const rows = [];
  for (const event of events) {
    const inserted = await sql`
      insert into catalyst_events (
        symbol, event_type, title, importance, source, event_time, payload
      )
      values (
        ${event.symbol}, ${event.eventType}, ${event.title}, ${event.importance},
        ${event.source}, ${safeIso(event.eventTime ?? null)}, ${JSON.stringify(event.payload)}::jsonb
      )
      returning id::text, symbol, event_type, captured_at::text
    `;
    rows.push(inserted[0]);
  }
  return rows;
}

export async function insertOptionVolatilitySnapshot(payload: OptionVolatilitySnapshotPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into option_volatility_snapshots (
      symbol, feed, data_quality, metrics, contracts
    )
    values (
      ${payload.symbol}, ${payload.feed}, ${payload.dataQuality},
      ${JSON.stringify(payload.metrics)}::jsonb, ${JSON.stringify(payload.contracts)}::jsonb
    )
    returning id::text, captured_at::text
  `;
  return rows[0];
}

export async function insertBrokerReconciliation(payload: BrokerReconciliationPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into broker_reconciliations (
      mode, orders_checked, activities_checked, events_inserted, status, summary
    )
    values (
      ${payload.mode}, ${payload.ordersChecked}, ${payload.activitiesChecked},
      ${payload.eventsInserted}, ${payload.status}, ${JSON.stringify(payload.summary)}::jsonb
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function insertResearchNote(payload: ResearchNotePayload) {
  const sql = getSql();
  const rows = await sql`
    insert into research_notes (
      symbol, note_type, title, body, tags, source
    )
    values (
      ${payload.symbol.trim().toUpperCase()}, ${payload.noteType ?? "research"},
      ${payload.title.trim()}, ${payload.body.trim()},
      ${JSON.stringify(payload.tags ?? [])}::jsonb, ${payload.source ?? "dashboard"}
    )
    returning id::text, symbol, note_type, title, body, tags, source, created_at::text, updated_at::text
  `;
  return rows[0];
}

export async function listResearchNotes(limit = 50, symbol?: string | null) {
  const sql = getSql();
  const cleanLimit = Math.max(1, Math.min(limit, 200));
  if (symbol) {
    return sql`
      select id::text, symbol, note_type, title, body, tags, source, created_at::text, updated_at::text
      from research_notes
      where symbol = ${symbol.trim().toUpperCase()}
      order by created_at desc
      limit ${cleanLimit}
    `;
  }
  return sql`
    select id::text, symbol, note_type, title, body, tags, source, created_at::text, updated_at::text
    from research_notes
    order by created_at desc
    limit ${cleanLimit}
  `;
}

export async function insertAutoResearchRun(payload: AutoResearchRunPayload) {
  const sql = getSql();
  const rows = await sql`
    insert into autoresearch_runs (
      run_label, mode, symbols, budget, champion, experiments, guardrails
    )
    values (
      ${payload.runLabel}, ${payload.mode}, ${JSON.stringify(payload.symbols)}::jsonb,
      ${payload.budget}, ${JSON.stringify(payload.champion)}::jsonb,
      ${JSON.stringify(payload.experiments)}::jsonb, ${JSON.stringify(payload.guardrails)}::jsonb
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

export async function listAutoResearchRuns(limit = 25) {
  const sql = getSql();
  return sql`
    select id::text, run_label, mode, symbols, budget, champion, experiments, guardrails, created_at::text
    from autoresearch_runs
    order by created_at desc
    limit ${Math.max(1, Math.min(limit, 100))}
  `;
}

export async function modelPerformanceSummary() {
  if (!databaseConfigured()) return null;
  const sql = getSql();
  const rows = await sql`
    select
      count(*)::int as total_signals,
      count(*) filter (where action = 'Buy Watch')::int as buy_watch_signals,
      count(*) filter (where action = 'Sell/Exit Watch')::int as sell_watch_signals,
      count(*) filter (where data_fresh)::int as fresh_signals,
      avg(confidence)::float as avg_confidence,
      avg(reward_risk)::float as avg_reward_risk
    from signal_snapshots
  `;
  const outcomes = await sql`
    select
      horizon,
      count(*)::int as count,
      avg(return_pct)::float as avg_return_pct,
      count(*) filter (where hit_target)::int as hit_targets,
      count(*) filter (where hit_stop)::int as hit_stops,
      count(*) filter (where return_pct > 0)::int as positive_outcomes
    from signal_outcomes
    group by horizon
    order by horizon
  `;
  const recentBacktests = await sql`
    select id::text, strategy, symbols, timeframe, lookback_days, metrics, status, data_source, created_at::text
    from strategy_backtests
    order by created_at desc
    limit 10
  `;
  return { summary: rows[0], outcomes, recentBacktests };
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function safeIso(value: string | undefined | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
