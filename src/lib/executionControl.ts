import { listBrokerOrders, type BrokerMode, type ValidatedBrokerOrder } from "@/lib/broker";
import { databaseConfigured, getSql } from "@/lib/db";
import { getControlValue, upsertControlValue } from "@/lib/persistence";

export type TradingControlState = {
  killSwitch: boolean;
  allowPaperOrders: boolean;
  allowLiveOrders: boolean;
  maxOpenOrders: number;
  maxOpenOrdersPerSymbol: number;
  maxDailySubmittedNotional: number;
  maxSingleOrderNotional: number;
  allowedAssetClasses: Array<"stock" | "crypto">;
  notes: string;
  updatedAt?: string;
};

export type PreTradeControlResult = {
  ok: boolean;
  state: TradingControlState;
  blockers: string[];
  warnings: string[];
  openOrdersChecked: number;
  dailySubmittedNotional: number;
};

export const defaultTradingControlState: TradingControlState = {
  killSwitch: false,
  allowPaperOrders: true,
  allowLiveOrders: true,
  maxOpenOrders: 10,
  maxOpenOrdersPerSymbol: 2,
  maxDailySubmittedNotional: 10_000,
  maxSingleOrderNotional: 5_000,
  allowedAssetClasses: ["stock", "crypto"],
  notes: "Default controls allow authenticated manual live orders when broker credentials, acknowledgement, audit storage, and pre-trade limits pass.",
};

export async function getTradingControlState(): Promise<TradingControlState> {
  if (!databaseConfigured()) return envBackedControlState(defaultTradingControlState);
  try {
    const stored = await getControlValue<Partial<TradingControlState>>("trading-controls");
    return envBackedControlState({ ...defaultTradingControlState, ...(stored ?? {}) });
  } catch {
    return envBackedControlState(defaultTradingControlState);
  }
}

export async function setTradingControlState(patch: Partial<TradingControlState>) {
  const next = sanitizeControlState({ ...(await getTradingControlState()), ...patch, updatedAt: new Date().toISOString() });
  if (!databaseConfigured()) {
    return { stored: false, state: next };
  }
  const row = await upsertControlValue("trading-controls", next as unknown as Record<string, unknown>);
  return { stored: true, state: row.value as TradingControlState };
}

export async function evaluatePreTradeControls({
  mode,
  order,
}: {
  mode: BrokerMode;
  order: ValidatedBrokerOrder;
}): Promise<PreTradeControlResult> {
  const state = await getTradingControlState();
  const notional = order.qty * order.limitPrice;
  const blockers = [
    state.killSwitch ? "Trading kill switch is active." : "",
    mode === "paper" && !state.allowPaperOrders ? "Paper order placement is disabled by control state." : "",
    mode === "live" && !state.allowLiveOrders ? "Live order placement is disabled by control state." : "",
    !state.allowedAssetClasses.includes(order.assetClass) ? `${order.assetClass} orders are disabled by control state.` : "",
    notional > state.maxSingleOrderNotional ? `Single-order notional exceeds control limit (${state.maxSingleOrderNotional}).` : "",
  ].filter(Boolean);

  let openOrders: Array<Record<string, unknown>> = [];
  try {
    openOrders = await listBrokerOrders({ mode, status: "open", limit: Math.max(50, state.maxOpenOrders + 5) });
  } catch {
    blockers.push("Open-order check failed; pre-trade controls fail closed.");
  }

  const symbolOpenOrders = openOrders.filter((item) => textField(item, "symbol") === order.symbol).length;
  const dailySubmittedNotional = await todaySubmittedNotional(mode);
  if (openOrders.length >= state.maxOpenOrders) blockers.push(`Open orders exceed control limit (${state.maxOpenOrders}).`);
  if (symbolOpenOrders >= state.maxOpenOrdersPerSymbol) blockers.push(`Open orders for ${order.symbol} exceed per-symbol limit (${state.maxOpenOrdersPerSymbol}).`);
  if (dailySubmittedNotional + notional > state.maxDailySubmittedNotional) blockers.push(`Daily submitted notional would exceed control limit (${state.maxDailySubmittedNotional}).`);

  const warnings = [
    mode === "live" ? "Live order requested; audit storage and acknowledgement remain mandatory." : "",
    state.notes,
  ].filter(Boolean);

  return {
    ok: blockers.length === 0,
    state,
    blockers,
    warnings,
    openOrdersChecked: openOrders.length,
    dailySubmittedNotional,
  };
}

function envBackedControlState(state: TradingControlState) {
  const allowLiveOrders = cleanEnvFlag(process.env.CONTROL_ALLOW_LIVE_ORDERS);
  return sanitizeControlState({
    ...state,
    killSwitch: process.env.TRADING_KILL_SWITCH === "true" || state.killSwitch,
    allowLiveOrders: allowLiveOrders ?? state.allowLiveOrders,
  });
}

function cleanEnvFlag(value: string | undefined) {
  const clean = value?.trim().toLowerCase();
  if (clean === "true") return true;
  if (clean === "false") return false;
  return null;
}

function sanitizeControlState(state: TradingControlState): TradingControlState {
  return {
    killSwitch: Boolean(state.killSwitch),
    allowPaperOrders: state.allowPaperOrders !== false,
    allowLiveOrders: Boolean(state.allowLiveOrders),
    maxOpenOrders: boundedNumber(state.maxOpenOrders, 1, 100, defaultTradingControlState.maxOpenOrders),
    maxOpenOrdersPerSymbol: boundedNumber(state.maxOpenOrdersPerSymbol, 1, 20, defaultTradingControlState.maxOpenOrdersPerSymbol),
    maxDailySubmittedNotional: boundedNumber(state.maxDailySubmittedNotional, 100, 10_000_000, defaultTradingControlState.maxDailySubmittedNotional),
    maxSingleOrderNotional: boundedNumber(state.maxSingleOrderNotional, 10, 5_000_000, defaultTradingControlState.maxSingleOrderNotional),
    allowedAssetClasses: validAssetClasses(state.allowedAssetClasses),
    notes: typeof state.notes === "string" ? state.notes.slice(0, 500) : defaultTradingControlState.notes,
    updatedAt: state.updatedAt,
  };
}

async function todaySubmittedNotional(mode: BrokerMode) {
  if (!databaseConfigured()) return 0;
  try {
    const sql = getSql();
    const rows = await sql<{ notional: number | string | null }>`
      select coalesce(sum(qty * coalesce(limit_price, 0)), 0)::float as notional
      from broker_order_requests
      where mode = ${mode}
        and created_at >= date_trunc('day', now())
        and status in ('requested', 'submitted')
    `;
    return Number(rows[0]?.notional ?? 0);
  } catch {
    return 0;
  }
}

function validAssetClasses(values: unknown) {
  if (!Array.isArray(values)) return defaultTradingControlState.allowedAssetClasses;
  const clean = values.filter((value): value is "stock" | "crypto" => value === "stock" || value === "crypto");
  return clean.length ? Array.from(new Set(clean)) : defaultTradingControlState.allowedAssetClasses;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.toUpperCase() : "";
}
