import { Pool } from "pg";
import { cleanSecret } from "@/lib/security";

type SqlQuery = <T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

let pool: Pool | null = null;
let client: SqlQuery | null = null;

export function databaseConfigured() {
  return Boolean(cleanSecret(process.env.DATABASE_URL));
}

export function getSql() {
  const url = cleanSecret(process.env.DATABASE_URL);
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!client) {
    pool = new Pool({
      connectionString: url,
      ssl: sslConfig(url),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    client = async (strings, ...values) => {
      if (!pool) throw new Error("Database pool is not initialized");
      const text = strings.reduce((query, chunk, index) => {
        return `${query}${chunk}${index < values.length ? `$${index + 1}` : ""}`;
      }, "");
      const result = await pool.query(text, values);
      return result.rows;
    };
  }
  return client;
}

export async function databaseSchemaStatus() {
  if (!databaseConfigured()) {
    return { configured: false, reachable: false, schemaReady: false, error: null as string | null };
  }

  try {
    const sql = getSql();
    const rows = await sql`
      select
        to_regclass('public.quote_snapshots') is not null as quote_snapshots,
        to_regclass('public.signal_snapshots') is not null as signal_snapshots,
        to_regclass('public.paper_trades') is not null as paper_trades,
        to_regclass('public.signal_outcomes') is not null as signal_outcomes,
        to_regclass('public.broker_order_requests') is not null as broker_order_requests,
        to_regclass('public.strategy_backtests') is not null as strategy_backtests,
        to_regclass('public.alert_events') is not null as alert_events,
        to_regclass('public.portfolio_risk_snapshots') is not null as portfolio_risk_snapshots,
        to_regclass('public.broker_order_events') is not null as broker_order_events,
        to_regclass('public.fundamental_snapshots') is not null as fundamental_snapshots,
        to_regclass('public.factor_snapshots') is not null as factor_snapshots,
        to_regclass('public.control_state') is not null as control_state,
        to_regclass('public.model_validation_reports') is not null as model_validation_reports,
        to_regclass('public.catalyst_events') is not null as catalyst_events,
        to_regclass('public.option_volatility_snapshots') is not null as option_volatility_snapshots,
        to_regclass('public.broker_reconciliations') is not null as broker_reconciliations,
        to_regclass('public.research_notes') is not null as research_notes,
        to_regclass('public.autoresearch_runs') is not null as autoresearch_runs
    `;
    const status = rows[0] as {
      quote_snapshots: boolean;
      signal_snapshots: boolean;
      paper_trades: boolean;
      signal_outcomes: boolean;
      broker_order_requests: boolean;
      strategy_backtests: boolean;
      alert_events: boolean;
      portfolio_risk_snapshots: boolean;
      broker_order_events: boolean;
      fundamental_snapshots: boolean;
      factor_snapshots: boolean;
      control_state: boolean;
      model_validation_reports: boolean;
      catalyst_events: boolean;
      option_volatility_snapshots: boolean;
      broker_reconciliations: boolean;
      research_notes: boolean;
      autoresearch_runs: boolean;
    };
    const schemaReady =
      status.quote_snapshots &&
      status.signal_snapshots &&
      status.paper_trades &&
      status.signal_outcomes &&
      status.broker_order_requests &&
      status.strategy_backtests &&
      status.alert_events &&
      status.portfolio_risk_snapshots &&
      status.broker_order_events &&
      status.fundamental_snapshots &&
      status.factor_snapshots &&
      status.control_state &&
      status.model_validation_reports &&
      status.catalyst_events &&
      status.option_volatility_snapshots &&
      status.broker_reconciliations &&
      status.research_notes &&
      status.autoresearch_runs;
    return { configured: true, reachable: true, schemaReady, error: null as string | null };
  } catch {
    return { configured: true, reachable: false, schemaReady: false, error: "Database readiness check failed" };
  }
}

function sslConfig(url: string) {
  const host = safeHost(url);
  if (!host) return undefined;
  if (host.includes("localhost") || host === "127.0.0.1") return undefined;
  return { rejectUnauthorized: false };
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function databaseUnavailableResponse() {
  return {
    ok: false,
    configured: false,
    error: "DATABASE_URL is not configured. Persistence APIs are ready but disabled.",
  };
}
