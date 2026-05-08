import type { ValidatedBrokerOrder } from "@/lib/broker";
import { cleanSecret } from "@/lib/security";
import type { SignalQuote, TradeSignal } from "@/lib/signalEngine";
import type { PaperTradePayload } from "@/lib/persistence";
import type { TradeTicket } from "@/lib/tradeTicket";

export type AitableTableKey =
  | "quoteSnapshots"
  | "signalSnapshots"
  | "tradeTickets"
  | "paperTrades"
  | "brokerOrders"
  | "signalOutcomes"
  | "watchlist";

type AitableRecord = Record<string, string | number | boolean | null>;

const tableEnv: Record<AitableTableKey, string> = {
  quoteSnapshots: "AITABLE_QUOTE_SNAPSHOTS_DATASHEET_ID",
  signalSnapshots: "AITABLE_SIGNAL_SNAPSHOTS_DATASHEET_ID",
  tradeTickets: "AITABLE_TRADE_TICKETS_DATASHEET_ID",
  paperTrades: "AITABLE_PAPER_TRADES_DATASHEET_ID",
  brokerOrders: "AITABLE_BROKER_ORDERS_DATASHEET_ID",
  signalOutcomes: "AITABLE_SIGNAL_OUTCOMES_DATASHEET_ID",
  watchlist: "AITABLE_WATCHLIST_DATASHEET_ID",
};

const requiredTables: AitableTableKey[] = ["quoteSnapshots", "signalSnapshots", "tradeTickets", "paperTrades", "brokerOrders"];

export const aitableSchema: Record<AitableTableKey, { env: string; name: string; description: string; fields: string[] }> = {
  quoteSnapshots: {
    env: tableEnv.quoteSnapshots,
    name: "Trading Intel - Quote Snapshots",
    description: "Mirrored market quote snapshots from the trading intelligence platform.",
    fields: [
      "Record Key",
      "Symbol",
      "Name",
      "Price",
      "Change",
      "ChangePct",
      "Open",
      "High",
      "Low",
      "Volume",
      "Source",
      "Quality",
      "Provider",
      "MarketStatus",
      "ProviderUpdatedAt",
      "CapturedAt",
      "RawJson",
    ],
  },
  signalSnapshots: {
    env: tableEnv.signalSnapshots,
    name: "Trading Intel - Signal Snapshots",
    description: "Mirrored buy/sell/hold signal snapshots and scoring context.",
    fields: [
      "Record Key",
      "Symbol",
      "Action",
      "Setup",
      "Confidence",
      "Quality",
      "Urgency",
      "Price",
      "Invalidation",
      "Target",
      "RewardRisk",
      "RiskPct",
      "Reason",
      "Warnings",
      "Confirmations",
      "DataFresh",
      "DataAgeMinutes",
      "GeneratedAt",
      "RawJson",
    ],
  },
  tradeTickets: {
    env: tableEnv.tradeTickets,
    name: "Trading Intel - Trade Tickets",
    description: "Mirrored trade plans with entries, stops, targets, sizing, and no-trade rules.",
    fields: [
      "Record Key",
      "Symbol",
      "Side",
      "Status",
      "Trigger",
      "EntrySignalNeeded",
      "Entry",
      "Stop",
      "Target",
      "Units",
      "Notional",
      "PotentialUnits",
      "PotentialNotional",
      "MaxLoss",
      "RewardRisk",
      "RiskRewardRatio",
      "RiskPct",
      "PositionSize",
      "SuggestedPositionSize",
      "Tradeable",
      "Reason",
      "MustConfirm",
      "DoNotTradeIf",
      "CreatedAt",
      "RawJson",
    ],
  },
  paperTrades: {
    env: tableEnv.paperTrades,
    name: "Trading Intel - Paper Trades",
    description: "Mirrored paper trades and paper broker order plans.",
    fields: [
      "Record Key",
      "Symbol",
      "Side",
      "Entry",
      "Stop",
      "Target",
      "Units",
      "MaxLoss",
      "Status",
      "Notes",
      "CreatedAt",
      "RawJson",
    ],
  },
  brokerOrders: {
    env: tableEnv.brokerOrders,
    name: "Trading Intel - Broker Orders",
    description: "Mirrored paper/live broker order requests and Alpaca responses.",
    fields: [
      "Record Key",
      "Mode",
      "Symbol",
      "AssetClass",
      "Side",
      "Qty",
      "OrderType",
      "LimitPrice",
      "TimeInForce",
      "OrderClass",
      "TakeProfit",
      "StopLoss",
      "ClientOrderId",
      "Status",
      "BrokerOrderId",
      "BrokerStatus",
      "LiveMoney",
      "CreatedAt",
      "RawJson",
    ],
  },
  signalOutcomes: {
    env: tableEnv.signalOutcomes,
    name: "Trading Intel - Signal Outcomes",
    description: "Mirrored signal outcome checks by horizon.",
    fields: [
      "Record Key",
      "SignalKey",
      "Symbol",
      "Horizon",
      "ObservedPrice",
      "ReturnPct",
      "HitTarget",
      "HitStop",
      "ObservedAt",
      "RawJson",
    ],
  },
  watchlist: {
    env: tableEnv.watchlist,
    name: "Trading Intel - Watchlist",
    description: "Mirrored operator watchlist and notes.",
    fields: [
      "Record Key",
      "Symbol",
      "Name",
      "Market",
      "Enabled",
      "Notes",
      "UpdatedAt",
      "RawJson",
    ],
  },
};

export function aitableConfig() {
  const tableIds = Object.fromEntries(
    Object.entries(tableEnv).map(([key, env]) => [key, cleanSecret(process.env[env])]),
  ) as Record<AitableTableKey, string>;
  return {
    enabled: cleanSecret(process.env.AITABLE_MIRROR_ENABLED) === "true",
    apiKeyConfigured: Boolean(cleanSecret(process.env.AITABLE_API_KEY)),
    spaceId: cleanSecret(process.env.AITABLE_SPACE_ID),
    baseUrl: normalizeBaseUrl(cleanSecret(process.env.AITABLE_BASE_URL) || "https://aitable.ai"),
    tableIds,
    requiredTablesReady: requiredTables.every((key) => Boolean(tableIds[key])),
  };
}

export function aitableReadiness() {
  const config = aitableConfig();
  const missing = [
    !config.enabled ? "AITABLE_MIRROR_ENABLED=true" : "",
    !config.apiKeyConfigured ? "AITABLE_API_KEY" : "",
    !config.spaceId ? "AITABLE_SPACE_ID" : "",
    ...requiredTables.map((key) => (!config.tableIds[key] ? tableEnv[key] : "")),
  ].filter(Boolean);
  return {
    provider: "aitable",
    enabled: config.enabled,
    apiKeyConfigured: config.apiKeyConfigured,
    spaceIdConfigured: Boolean(config.spaceId),
    tableIdsConfigured: Object.fromEntries(
      Object.entries(config.tableIds).map(([key, value]) => [key, Boolean(value)]),
    ) as Record<AitableTableKey, boolean>,
    mirrorReady: config.enabled && config.apiKeyConfigured && config.requiredTablesReady,
    missing,
    notes: [
      "AITable is an operational mirror and fallback, not an execution-grade tick database.",
      "Records are written in batches of 10 to respect AITable's create-record limits.",
      "Live broker execution still requires the SQL audit database before it can be armed.",
    ],
  };
}

export async function listAitableSpaces() {
  return aitableRequest<{ data?: { spaces?: Array<Record<string, unknown>> } }>("/fusion/v1/spaces");
}

export async function createAitableDatasheet({
  spaceId,
  name,
  description,
  fields,
}: {
  spaceId: string;
  name: string;
  description: string;
  fields: string[];
}) {
  return aitableRequest<{ data?: { id?: string } }>(`/fusion/v1/spaces/${encodeURIComponent(spaceId)}/datasheets`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      fields: fields.map((field) => ({ type: "Text", name: field })),
    }),
  });
}

export async function listAitableRecords(table: AitableTableKey, limit = 50) {
  const datasheetId = datasheetIdFor(table);
  if (!datasheetId) throw new Error(`${tableEnv[table]} is not configured.`);
  const params = new URLSearchParams({ pageSize: String(Math.max(1, Math.min(limit, 1000))), maxRecords: String(Math.max(1, Math.min(limit, 1000))) });
  return aitableRequest<{ data?: { records?: Array<Record<string, unknown>> } }>(`/fusion/v1/datasheets/${encodeURIComponent(datasheetId)}/records?${params}`);
}

export async function mirrorAitableRecords(table: AitableTableKey, records: AitableRecord[]) {
  const readiness = aitableReadiness();
  if (!readiness.mirrorReady || records.length === 0) {
    return { ok: false, skipped: true, table, records: 0, error: readiness.missing.join(", ") || "AITable mirror is not ready." };
  }

  const datasheetId = datasheetIdFor(table);
  if (!datasheetId) {
    return { ok: false, skipped: true, table, records: 0, error: `${tableEnv[table]} is not configured.` };
  }

  let written = 0;
  for (let index = 0; index < records.length; index += 10) {
    const batch = records.slice(index, index + 10);
    await aitableRequest(`/fusion/v1/datasheets/${encodeURIComponent(datasheetId)}/records`, {
      method: "POST",
      body: JSON.stringify({
        fieldKey: "name",
        records: batch.map((fields) => ({ fields: normalizeFields(fields) })),
      }),
    });
    written += batch.length;
  }

  return { ok: true, skipped: false, table, records: written, error: null as string | null };
}

export async function safeMirrorAitableRecords(table: AitableTableKey, records: AitableRecord[]) {
  try {
    return await mirrorAitableRecords(table, records);
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      table,
      records: 0,
      error: error instanceof Error ? error.message : "AITable mirror write failed.",
    };
  }
}

export function quoteToAitableRecord(quote: SignalQuote, provider = "auto"): AitableRecord {
  const capturedAt = new Date().toISOString();
  return {
    "Record Key": `quote-${quote.symbol}-${capturedAt}`,
    Symbol: quote.symbol,
    Name: quote.name,
    Price: quote.price,
    Change: quote.change,
    ChangePct: quote.changePct,
    Open: quote.open,
    High: quote.high,
    Low: quote.low,
    Volume: quote.volume,
    Source: quote.source,
    Quality: quote.quality ?? "",
    Provider: provider,
    MarketStatus: quote.marketStatus ?? "",
    ProviderUpdatedAt: quote.updatedAt,
    CapturedAt: capturedAt,
    RawJson: stringifyForAitable(quote),
  };
}

export function signalToAitableRecord(signal: TradeSignal): AitableRecord {
  return {
    "Record Key": `signal-${signal.symbol}-${signal.generatedAt}`,
    Symbol: signal.symbol,
    Action: signal.action,
    Setup: signal.setup,
    Confidence: signal.confidence,
    Quality: signal.quality,
    Urgency: signal.urgency,
    Price: signal.price,
    Invalidation: signal.invalidation,
    Target: signal.target,
    RewardRisk: signal.rewardRisk,
    RiskPct: signal.positionRiskPct,
    Reason: signal.reason,
    Warnings: signal.warnings.join("; "),
    Confirmations: signal.confirmations.join("; "),
    DataFresh: signal.dataFresh,
    DataAgeMinutes: signal.dataAgeMinutes,
    GeneratedAt: signal.generatedAt,
    RawJson: stringifyForAitable(signal),
  };
}

export function tradeTicketToAitableRecord(ticket: TradeTicket): AitableRecord {
  const createdAt = new Date().toISOString();
  return {
    "Record Key": `ticket-${ticket.symbol}-${createdAt}`,
    Symbol: ticket.symbol,
    Side: ticket.side,
    Status: ticket.status,
    Trigger: ticket.trigger,
    EntrySignalNeeded: ticket.entrySignalNeeded,
    Entry: ticket.entry,
    Stop: ticket.stop,
    Target: ticket.target,
    Units: ticket.units,
    Notional: ticket.notional,
    PotentialUnits: ticket.potentialUnits,
    PotentialNotional: ticket.potentialNotional,
    MaxLoss: ticket.maxLoss,
    RewardRisk: ticket.rewardRisk,
    RiskRewardRatio: ticket.riskRewardRatio,
    RiskPct: ticket.riskPct,
    PositionSize: ticket.positionSize,
    SuggestedPositionSize: ticket.suggestedPositionSize,
    Tradeable: ticket.tradeable,
    Reason: ticket.reason,
    MustConfirm: ticket.mustConfirm.join("; "),
    DoNotTradeIf: ticket.doNotTradeIf.join("; "),
    CreatedAt: createdAt,
    RawJson: stringifyForAitable(ticket),
  };
}

export function paperTradeToAitableRecord(payload: PaperTradePayload): AitableRecord {
  const createdAt = new Date().toISOString();
  return {
    "Record Key": `paper-${payload.symbol}-${createdAt}`,
    Symbol: payload.symbol,
    Side: payload.side,
    Entry: payload.entry,
    Stop: payload.stop,
    Target: payload.target,
    Units: payload.units,
    MaxLoss: payload.maxLoss,
    Status: payload.status ?? "Watching",
    Notes: payload.notes ?? "",
    CreatedAt: createdAt,
    RawJson: stringifyForAitable(payload),
  };
}

export function brokerOrderToAitableRecord({
  mode,
  order,
  status,
  brokerResponse,
}: {
  mode: "paper" | "live";
  order: ValidatedBrokerOrder;
  status: string;
  brokerResponse?: Record<string, unknown> | null;
}): AitableRecord {
  const createdAt = new Date().toISOString();
  return {
    "Record Key": `broker-${mode}-${order.clientOrderId}-${createdAt}`,
    Mode: mode,
    Symbol: order.symbol,
    AssetClass: order.assetClass,
    Side: order.side,
    Qty: order.qty,
    OrderType: order.type,
    LimitPrice: order.limitPrice,
    TimeInForce: order.timeInForce,
    OrderClass: order.orderClass,
    TakeProfit: order.takeProfitLimitPrice ?? "",
    StopLoss: order.stopLossStopPrice ?? "",
    ClientOrderId: order.clientOrderId,
    Status: status,
    BrokerOrderId: textValue(brokerResponse?.id),
    BrokerStatus: textValue(brokerResponse?.status),
    LiveMoney: mode === "live",
    CreatedAt: createdAt,
    RawJson: stringifyForAitable({ order, brokerResponse }),
  };
}

export function signalOutcomeToAitableRecord({
  signalKey,
  symbol,
  horizon,
  observedPrice,
  returnPct,
  hitTarget,
  hitStop,
  raw,
}: {
  signalKey: string;
  symbol: string;
  horizon: string;
  observedPrice: number;
  returnPct: number;
  hitTarget: boolean;
  hitStop: boolean;
  raw?: unknown;
}): AitableRecord {
  const observedAt = new Date().toISOString();
  return {
    "Record Key": `outcome-${signalKey}-${horizon}-${observedAt}`,
    SignalKey: signalKey,
    Symbol: symbol,
    Horizon: horizon,
    ObservedPrice: observedPrice,
    ReturnPct: returnPct,
    HitTarget: hitTarget,
    HitStop: hitStop,
    ObservedAt: observedAt,
    RawJson: stringifyForAitable(raw ?? { signalKey, symbol, horizon, observedPrice, returnPct, hitTarget, hitStop }),
  };
}

function datasheetIdFor(table: AitableTableKey) {
  return aitableConfig().tableIds[table];
}

async function aitableRequest<T>(path: string, init: RequestInit = {}) {
  const config = aitableConfig();
  const apiKey = cleanSecret(process.env.AITABLE_API_KEY);
  if (!apiKey) throw new Error("AITABLE_API_KEY is not configured.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(`${config.baseUrl}${path}`, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  const body = text ? parseJson(text) : null;
  if (!response.ok || (body && typeof body === "object" && "success" in body && body.success === false)) {
    throw new Error(aitableErrorMessage(body) ?? `AITable request failed with status ${response.status}.`);
  }
  return body as T;
}

function normalizeFields(record: AitableRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, textValue(value).slice(0, 8000)]),
  );
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringifyForAitable(value);
}

function stringifyForAitable(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function aitableErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const item = body as { message?: unknown; error?: unknown };
  return typeof item.message === "string" ? item.message : typeof item.error === "string" ? item.error : null;
}
