import { databaseSchemaStatus, getSql } from "@/lib/db";
import { cleanSecret } from "@/lib/security";

export type BrokerMode = "paper" | "live";
export type BrokerAssetClass = "stock" | "crypto";

export type BrokerOrderPayload = {
  symbol: string;
  assetClass?: BrokerAssetClass;
  side: "buy" | "sell";
  qty: number;
  type: "limit";
  limitPrice: number;
  timeInForce?: "day" | "gtc" | "ioc";
  extendedHours?: boolean;
  orderClass?: "simple" | "bracket";
  takeProfitLimitPrice?: number;
  stopLossStopPrice?: number;
  clientOrderId?: string;
  acknowledgement?: string;
  source?: "trade-ticket" | "manual";
};

export type ValidatedBrokerOrder = Omit<BrokerOrderPayload, "acknowledgement"> & {
  assetClass: BrokerAssetClass;
  timeInForce: "day" | "gtc" | "ioc";
  orderClass: "simple" | "bracket";
  clientOrderId: string;
};

export type BrokerConfig = {
  provider: "alpaca";
  mode: BrokerMode;
  baseUrl: string;
  dataBaseUrl: string;
  credentialsConfigured: boolean;
  executionEnabled: boolean;
  liveTradingEnabled: boolean;
  liveAckConfigured: boolean;
  maxOrderNotional: number;
  maxOrderUnits: number;
  allowExtendedHours: boolean;
  dataQuality: string;
};

const futuresAndResearchAliases = new Set([
  "GOLD",
  "SILVER",
  "OIL",
  "NATGAS",
  "COPPER",
  "CORN",
  "WHEAT",
  "SOY",
  "BTCUSD",
  "ETHUSD",
]);

const stockSymbolPattern = /^[A-Z][A-Z0-9.]{0,9}$/;
const cryptoSymbolPattern = /^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/;

export function parseBrokerMode(value: string | null | undefined): BrokerMode {
  return value?.trim().toLowerCase() === "live" ? "live" : "paper";
}

export function brokerConfig(modeOverride?: BrokerMode): BrokerConfig {
  const configuredMode = parseBrokerMode(cleanSecret(process.env.BROKER_EXECUTION_MODE));
  const mode = modeOverride ?? configuredMode;
  const credentials = credentialsForMode(mode);
  const liveTradingExplicitlyDisabled = cleanSecret(process.env.ALPACA_LIVE_TRADING_ENABLED)?.toLowerCase() === "false";
  return {
    provider: "alpaca",
    mode,
    baseUrl:
      mode === "live"
        ? normalizeEndpoint(cleanSecret(process.env.ALPACA_LIVE_API_ENDPOINT_URL) || cleanSecret(process.env.ALPACA_API_ENDPOINT_URL) || "https://api.alpaca.markets")
        : normalizeEndpoint(cleanSecret(process.env.ALPACA_PAPER_API_ENDPOINT_URL) || cleanSecret(process.env.ALPACA_PAPER_ACCOUNT_API_ENDPOINT_URL) || "https://paper-api.alpaca.markets"),
    dataBaseUrl: normalizeEndpoint(cleanSecret(process.env.ALPACA_DATA_API_ENDPOINT_URL) || "https://data.alpaca.markets"),
    credentialsConfigured: Boolean(credentials.key && credentials.secret),
    executionEnabled: cleanSecret(process.env.BROKER_EXECUTION_ENABLED) === "true",
    liveTradingEnabled: mode === "live" && !liveTradingExplicitlyDisabled,
    liveAckConfigured: Boolean(cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK)),
    maxOrderNotional: parseEnvNumber("BROKER_MAX_ORDER_NOTIONAL", 5000, 1, 1_000_000),
    maxOrderUnits: parseEnvNumber("BROKER_MAX_ORDER_UNITS", 100, 1, 1_000_000),
    allowExtendedHours: cleanSecret(process.env.BROKER_ALLOW_EXTENDED_HOURS) === "true",
    dataQuality: cleanSecret(process.env.ALPACA_DATA_QUALITY) || "iex",
  };
}

export async function brokerReadiness(modeOverride?: BrokerMode) {
  const config = brokerConfig(modeOverride);
  const database = await databaseSchemaStatus();
  const liveAuditReady = config.mode !== "live" || database.schemaReady;
  const orderPlacementReady =
    config.executionEnabled &&
    config.credentialsConfigured &&
    (config.mode === "paper" || (config.liveTradingEnabled && config.liveAckConfigured && liveAuditReady));

  return {
    ...config,
    orderPlacementReady,
    liveAuditReady,
    database,
    missing: [
      !config.executionEnabled ? "BROKER_EXECUTION_ENABLED=true" : "",
      !config.credentialsConfigured ? credentialLabel(config.mode) : "",
      config.mode === "live" && !config.liveTradingEnabled ? "ALPACA_LIVE_TRADING_ENABLED is set to false" : "",
      config.mode === "live" && !config.liveAckConfigured ? "BROKER_LIVE_EXECUTION_ACK" : "",
      config.mode === "live" && !database.schemaReady ? "DATABASE_URL with database/schema.sql applied" : "",
    ].filter(Boolean),
    restrictions: [
      "Only authenticated user sessions can access broker routes.",
      "Cron/bearer automation cannot place broker orders.",
      "Stock/ETF order placement is limit-order only.",
      "Crypto order placement is limit-order only and requires slash symbols such as BTC/USD.",
      "Market orders are blocked.",
      "Commodity futures aliases are blocked from the stock/ETF broker rail.",
      "Live mode requires a matching per-order acknowledgement phrase.",
      "Live mode requires database-backed order-request audit storage.",
    ],
  };
}

export async function allBrokerReadiness() {
  const [paper, live] = await Promise.all([brokerReadiness("paper"), brokerReadiness("live")]);
  return { paper, live };
}

export function validateBrokerOrderPayload(payload: unknown, config = brokerConfig()) {
  if (!payload || typeof payload !== "object") {
    return { ok: false as const, error: "Order payload must be an object." };
  }

  const item = payload as Partial<BrokerOrderPayload>;
  const assetClass = item.assetClass === "crypto" ? "crypto" : "stock";
  const symbol = normalizeOrderSymbol(item.symbol, assetClass);
  const side = item.side?.trim().toLowerCase();
  const type = item.type?.trim().toLowerCase();
  const qty = Number(item.qty);
  const limitPrice = Number(item.limitPrice);
  const timeInForce = normalizeTimeInForce(item.timeInForce, assetClass);
  const orderClass = item.orderClass === "bracket" ? "bracket" : "simple";
  const takeProfitLimitPrice = numberOrNull(item.takeProfitLimitPrice);
  const stopLossStopPrice = numberOrNull(item.stopLossStopPrice);
  const notional = qty * limitPrice;
  const clientOrderId = cleanClientOrderId(item.clientOrderId);
  const extendedHours = Boolean(item.extendedHours);

  if (assetClass === "stock" && !stockSymbolPattern.test(symbol)) return { ok: false as const, error: "Symbol is not accepted for stock/ETF broker execution." };
  if (assetClass === "crypto" && !cryptoSymbolPattern.test(symbol)) return { ok: false as const, error: "Crypto symbols must use slash format, such as BTC/USD." };
  if (futuresAndResearchAliases.has(symbol)) return { ok: false as const, error: `${symbol} is a research alias, not a tradeable broker symbol.` };
  if (side !== "buy" && side !== "sell") return { ok: false as const, error: "Order side must be buy or sell." };
  if (type !== "limit") return { ok: false as const, error: "Only limit orders are accepted." };
  if (assetClass === "stock" && timeInForce !== "day") return { ok: false as const, error: "Stock/ETF orders must use day time-in-force." };
  if (assetClass === "crypto" && timeInForce !== "gtc" && timeInForce !== "ioc") return { ok: false as const, error: "Crypto orders must use gtc or ioc time-in-force." };
  if (assetClass === "stock" && (!Number.isInteger(qty) || qty < 1)) return { ok: false as const, error: "Stock/ETF quantity must be a whole-share amount of at least 1." };
  if (assetClass === "crypto" && (!Number.isFinite(qty) || qty <= 0)) return { ok: false as const, error: "Crypto quantity must be positive." };
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return { ok: false as const, error: "Limit price must be positive." };
  if (qty > config.maxOrderUnits) return { ok: false as const, error: `Quantity exceeds max order units (${config.maxOrderUnits}).` };
  if (notional > config.maxOrderNotional) return { ok: false as const, error: `Order notional exceeds max allowed (${config.maxOrderNotional}).` };
  if (extendedHours && !config.allowExtendedHours) return { ok: false as const, error: "Extended-hours orders are disabled." };
  if (orderClass === "bracket") {
    if (assetClass !== "stock") return { ok: false as const, error: "Bracket orders are only enabled for stock/ETF orders." };
    if (takeProfitLimitPrice === null || stopLossStopPrice === null) {
      return { ok: false as const, error: "Bracket orders require take-profit and stop-loss prices." };
    }
    if (side === "buy" && (takeProfitLimitPrice <= limitPrice || stopLossStopPrice >= limitPrice)) {
      return { ok: false as const, error: "Buy bracket requires take profit above entry and stop loss below entry." };
    }
    if (side === "sell" && (takeProfitLimitPrice >= limitPrice || stopLossStopPrice <= limitPrice)) {
      return { ok: false as const, error: "Sell bracket requires take profit below entry and stop loss above entry." };
    }
  }
  if (config.mode === "live" && cleanSecret(item.acknowledgement) !== cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK)) {
    return { ok: false as const, error: "Live execution acknowledgement did not match." };
  }

  return {
    ok: true as const,
    order: {
      symbol,
      assetClass,
      side: side as "buy" | "sell",
      qty,
      type: "limit" as const,
      limitPrice: Number(limitPrice.toFixed(assetClass === "crypto" ? 8 : 2)),
      timeInForce,
      extendedHours,
      orderClass,
      takeProfitLimitPrice: takeProfitLimitPrice ? Number(takeProfitLimitPrice.toFixed(2)) : undefined,
      stopLossStopPrice: stopLossStopPrice ? Number(stopLossStopPrice.toFixed(2)) : undefined,
      clientOrderId,
      source: item.source === "manual" ? "manual" : "trade-ticket",
    } satisfies ValidatedBrokerOrder,
  };
}

export async function alpacaRequest<T>(path: string, init: RequestInit = {}, mode?: BrokerMode) {
  const config = brokerConfig(mode);
  const credentials = credentialsForMode(config.mode);
  if (!credentials.key || !credentials.secret) {
    throw new Error(`${config.mode} Alpaca credentials are not configured.`);
  }
  return requestJson<T>(`${config.baseUrl}${path}`, init, credentials);
}

export async function alpacaDataRequest<T>(path: string, init: RequestInit = {}, mode?: BrokerMode) {
  const config = brokerConfig(mode);
  const credentials = credentialsForMode(config.mode);
  if (!credentials.key || !credentials.secret) {
    throw new Error(`${config.mode} Alpaca credentials are not configured.`);
  }
  return requestJson<T>(`${config.dataBaseUrl}${path}`, init, credentials);
}

export async function submitAlpacaOrder(order: ValidatedBrokerOrder, mode?: BrokerMode) {
  const body: Record<string, unknown> = {
    symbol: order.symbol,
    qty: String(order.qty),
    side: order.side,
    type: order.type,
    time_in_force: order.timeInForce,
    limit_price: String(order.limitPrice),
    extended_hours: order.extendedHours,
    client_order_id: order.clientOrderId,
  };

  if (order.orderClass === "bracket") {
    body.order_class = "bracket";
    body.take_profit = { limit_price: String(order.takeProfitLimitPrice) };
    body.stop_loss = { stop_price: String(order.stopLossStopPrice) };
  }

  return alpacaRequest<Record<string, unknown>>("/v2/orders", {
    method: "POST",
    body: JSON.stringify(body),
  }, mode);
}

export function getBrokerAccount(mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>("/v2/account", {}, mode);
}

export function getBrokerPositions(mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>[]>("/v2/positions", {}, mode);
}

export function getBrokerPosition(symbol: string, mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>(`/v2/positions/${encodeURIComponent(symbol)}`, {}, mode);
}

export function listBrokerOrders({ mode, status = "open", limit = 50 }: { mode?: BrokerMode; status?: string; limit?: number } = {}) {
  const params = new URLSearchParams({ status, limit: String(Math.max(1, Math.min(limit, 500))), nested: "true" });
  return alpacaRequest<Record<string, unknown>[]>(`/v2/orders?${params}`, {}, mode);
}

export function getBrokerOrder(id: string, mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>(`/v2/orders/${encodeURIComponent(id)}?nested=true`, {}, mode);
}

export function replaceBrokerOrder(id: string, payload: Record<string, unknown>, mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>(`/v2/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, mode);
}

export function buildReplacementOrderPayload(
  existingOrder: Record<string, unknown>,
  replacement: { qty?: number | string; limitPrice?: number | string; timeInForce?: string; acknowledgement?: string },
): BrokerOrderPayload {
  const symbol = readText(existingOrder, "symbol");
  return {
    symbol,
    assetClass: symbol.includes("/") ? "crypto" : "stock",
    side: readText(existingOrder, "side").toLowerCase() === "sell" ? "sell" : "buy",
    qty: replacement.qty === undefined ? readNumber(existingOrder, "qty") : Number(replacement.qty),
    type: "limit",
    limitPrice: replacement.limitPrice === undefined ? readNumber(existingOrder, "limit_price") : Number(replacement.limitPrice),
    timeInForce: normalizeReplacementTimeInForce(replacement.timeInForce ?? readText(existingOrder, "time_in_force")),
    extendedHours: Boolean(existingOrder.extended_hours),
    orderClass: readText(existingOrder, "order_class") === "bracket" ? "bracket" : "simple",
    takeProfitLimitPrice: readNestedNumber(existingOrder, "take_profit", "limit_price"),
    stopLossStopPrice: readNestedNumber(existingOrder, "stop_loss", "stop_price"),
    clientOrderId: readText(existingOrder, "client_order_id") || undefined,
    acknowledgement: replacement.acknowledgement,
    source: "manual",
  };
}

export function cancelBrokerOrder(id: string, mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown> | null>(`/v2/orders/${encodeURIComponent(id)}`, { method: "DELETE" }, mode);
}

export function cancelAllBrokerOrders(mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>[]>("/v2/orders", { method: "DELETE" }, mode);
}

export function closeBrokerPosition(symbol: string, mode?: BrokerMode, percentage?: number) {
  const query = percentage ? `?percentage=${encodeURIComponent(String(percentage))}` : "";
  return alpacaRequest<Record<string, unknown>>(`/v2/positions/${encodeURIComponent(symbol)}${query}`, { method: "DELETE" }, mode);
}

export function closeAllBrokerPositions(mode?: BrokerMode, cancelOrders = true) {
  return alpacaRequest<Record<string, unknown>[]>(`/v2/positions?cancel_orders=${cancelOrders}`, { method: "DELETE" }, mode);
}

export function getPortfolioHistory(mode?: BrokerMode, query = "period=1M&timeframe=1D&intraday_reporting=extended_hours") {
  return alpacaRequest<Record<string, unknown>>(`/v2/account/portfolio/history?${query}`, {}, mode);
}

export function getAccountActivities(mode?: BrokerMode, query = "direction=desc&page_size=50") {
  return alpacaRequest<Record<string, unknown>[]>(`/v2/account/activities?${query}`, {}, mode);
}

export function listAssets(mode?: BrokerMode, query = "status=active") {
  return alpacaRequest<Record<string, unknown>[]>(`/v2/assets?${query}`, {}, mode);
}

export function getAsset(symbol: string, mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>(`/v2/assets/${encodeURIComponent(symbol)}`, {}, mode);
}

export function getMarketClock(mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>("/v2/clock", {}, mode);
}

export function getMarketCalendar(mode?: BrokerMode, query = "") {
  return alpacaRequest<Record<string, unknown>[]>(`/v2/calendar${query ? `?${query}` : ""}`, {}, mode);
}

export function getWatchlists(mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>[]>("/v2/watchlists", {}, mode);
}

export function createWatchlist(name: string, symbols: string[], mode?: BrokerMode) {
  return alpacaRequest<Record<string, unknown>>("/v2/watchlists", {
    method: "POST",
    body: JSON.stringify({ name, symbols }),
  }, mode);
}

export function getCorporateActions(mode?: BrokerMode, query = "") {
  return alpacaDataRequest<Record<string, unknown>>(`/v1/corporate-actions${query ? `?${query}` : ""}`, {}, mode);
}

export function getStockSnapshots(symbols: string[], mode?: BrokerMode, feed?: string) {
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  if (feed) params.set("feed", feed);
  return alpacaDataRequest<Record<string, unknown>>(`/v2/stocks/snapshots?${params}`, {}, mode);
}

export function getStockBars(symbols: string[], mode?: BrokerMode, query = "timeframe=1Day&limit=100") {
  const params = new URLSearchParams(query);
  params.set("symbols", symbols.join(","));
  return alpacaDataRequest<Record<string, unknown>>(`/v2/stocks/bars?${params}`, {}, mode);
}

export function getAlpacaNews(symbols: string[], mode?: BrokerMode, query = "limit=20&sort=desc") {
  const params = new URLSearchParams(query);
  if (symbols.length) params.set("symbols", symbols.join(","));
  return alpacaDataRequest<Record<string, unknown>>(`/v1beta1/news?${params}`, {}, mode);
}

export function getCryptoSnapshots(symbols: string[], mode?: BrokerMode) {
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  return alpacaDataRequest<Record<string, unknown>>(`/v1beta3/crypto/us/snapshots?${params}`, {}, mode);
}

export function getOptionContracts(underlyingSymbols: string[], mode?: BrokerMode, query = "status=active&limit=100") {
  const params = new URLSearchParams(query);
  params.set("underlying_symbols", underlyingSymbols.join(","));
  return alpacaRequest<Record<string, unknown>>(`/v2/options/contracts?${params}`, {}, mode);
}

export function getOptionSnapshots(symbols: string[], mode?: BrokerMode, feed?: string) {
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  if (feed) params.set("feed", feed);
  return alpacaDataRequest<Record<string, unknown>>(`/v1beta1/options/snapshots?${params}`, {}, mode);
}

export async function createBrokerOrderAudit(order: ValidatedBrokerOrder, mode: BrokerMode) {
  const sql = getSql();
  const rows = await sql`
    insert into broker_order_requests (
      mode, symbol, side, qty, order_type, limit_price, time_in_force,
      extended_hours, max_notional, client_order_id, status
    )
    values (
      ${mode}, ${order.symbol}, ${order.side}, ${order.qty}, ${order.type}, ${order.limitPrice},
      ${order.timeInForce}, ${Boolean(order.extendedHours)}, ${brokerConfig(mode).maxOrderNotional},
      ${order.clientOrderId ?? null}, 'requested'
    )
    returning id
  `;
  return String(rows[0].id);
}

export async function updateBrokerOrderAudit(id: string, status: string, brokerResponse: Record<string, unknown> | null) {
  const sql = getSql();
  await sql`
    update broker_order_requests
    set
      status = ${status},
      broker_order_id = ${brokerResponse?.id ? String(brokerResponse.id) : null},
      broker_status = ${brokerResponse?.status ? String(brokerResponse.status) : null},
      broker_response = ${brokerResponse ? JSON.stringify(brokerResponse) : null}::jsonb,
      updated_at = now()
    where id = ${id}
  `;
}

export async function insertBrokerOrderEvent({
  auditId,
  mode,
  brokerOrderId,
  clientOrderId,
  symbol,
  eventType,
  brokerStatus,
  payload,
}: {
  auditId?: string | null;
  mode: BrokerMode;
  brokerOrderId?: string | null;
  clientOrderId?: string | null;
  symbol?: string | null;
  eventType: string;
  brokerStatus?: string | null;
  payload: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    insert into broker_order_events (
      broker_order_request_id, mode, broker_order_id, client_order_id, symbol,
      event_type, broker_status, payload
    )
    values (
      ${auditId ?? null}, ${mode}, ${brokerOrderId ?? null}, ${clientOrderId ?? null},
      ${symbol ?? null}, ${eventType}, ${brokerStatus ?? null}, ${JSON.stringify(payload)}::jsonb
    )
    returning id::text, created_at::text
  `;
  return rows[0];
}

function credentialsForMode(mode: BrokerMode): { key: string; secret: string } {
  const configuredMode = parseBrokerMode(cleanSecret(process.env.BROKER_EXECUTION_MODE));
  if (mode === "paper") {
    return {
      key:
        cleanSecret(process.env.ALPACA_PAPER_API_KEY_ID) ||
        cleanSecret(process.env.ALPACA_PAPER_ACCOUNT_API_KEY) ||
        (configuredMode === "paper" ? cleanSecret(process.env.ALPACA_API_KEY_ID) : "") ||
        "",
      secret:
        cleanSecret(process.env.ALPACA_PAPER_API_SECRET_KEY) ||
        cleanSecret(process.env.ALPACA_PAPER_ACCOUNT_API_SECRET_KEY) ||
        (configuredMode === "paper" ? cleanSecret(process.env.ALPACA_API_SECRET_KEY) : "") ||
        "",
    };
  }

  return {
    key:
      cleanSecret(process.env.ALPACA_LIVE_API_KEY_ID) ||
      (configuredMode === "live" ? cleanSecret(process.env.ALPACA_API_KEY_ID) : "") ||
      "",
    secret:
      cleanSecret(process.env.ALPACA_LIVE_API_SECRET_KEY) ||
      cleanSecret(process.env.ALPACA_LIVE_SECRET_KEY) ||
      (configuredMode === "live" ? cleanSecret(process.env.ALPACA_API_SECRET_KEY) : "") ||
      "",
  };
}

async function requestJson<T>(url: string, init: RequestInit, credentials: { key: string; secret: string }) {
  const headers = new Headers(init.headers);
  headers.set("APCA-API-KEY-ID", credentials.key);
  headers.set("APCA-API-SECRET-KEY", credentials.secret);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  const body = text ? parseJson(text) : null;

  if (!response.ok) {
    const message = brokerErrorMessage(body) ?? `Alpaca request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return body as T;
}

function credentialLabel(mode: BrokerMode) {
  return mode === "live"
    ? "ALPACA_LIVE_API_KEY_ID and ALPACA_LIVE_API_SECRET_KEY"
    : "ALPACA_PAPER_API_KEY_ID and ALPACA_PAPER_API_SECRET_KEY";
}

function normalizeOrderSymbol(symbol: string | undefined, assetClass: BrokerAssetClass) {
  const clean = symbol?.trim().toUpperCase() ?? "";
  if (assetClass === "crypto" && !clean.includes("/") && /^[A-Z0-9]{5,12}$/.test(clean)) {
    return clean.replace(/(USD|USDT)$/, "/$1");
  }
  return clean;
}

function normalizeTimeInForce(value: string | undefined, assetClass: BrokerAssetClass) {
  const clean = value?.trim().toLowerCase();
  if (assetClass === "crypto") return clean === "ioc" ? "ioc" : "gtc";
  return "day";
}

function normalizeReplacementTimeInForce(value: string): BrokerOrderPayload["timeInForce"] {
  const clean = value.trim().toLowerCase();
  if (clean === "gtc" || clean === "ioc") return clean;
  return "day";
}

function parseEnvNumber(key: string, fallback: number, min: number, max: number) {
  const parsed = Number(cleanSecret(process.env[key]));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanClientOrderId(value: string | undefined) {
  const clean = value?.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  return clean || `ti-${Date.now()}`;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEndpoint(value: string) {
  return value.replace(/\/+$/, "").replace(/\/v2$/i, "");
}

function readText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNumber(record: Record<string, unknown>, key: string) {
  const parsed = Number(record[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNestedNumber(record: Record<string, unknown>, key: string, nestedKey: string) {
  const value = record[key];
  if (!value || typeof value !== "object") return undefined;
  const parsed = Number((value as Record<string, unknown>)[nestedKey]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function brokerErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const item = body as { message?: unknown; error?: unknown };
  return typeof item.message === "string" ? item.message : typeof item.error === "string" ? item.error : null;
}
