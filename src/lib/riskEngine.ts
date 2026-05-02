import type { BrokerMode } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { insertPortfolioRiskSnapshot, listPortfolioRiskSnapshots } from "@/lib/persistence";

export type PortfolioRiskReport = {
  mode: BrokerMode;
  equity: number | null;
  cash: number | null;
  buyingPower: number | null;
  marketValue: number | null;
  dailyPnl: number | null;
  dailyPnlPct: number | null;
  grossExposure: number;
  netExposure: number;
  longExposure: number;
  shortExposure: number;
  openOrdersNotional: number;
  concentration: Array<{
    symbol: string;
    side: "long" | "short";
    marketValue: number;
    pctOfEquity: number;
    unrealizedPnl: number;
  }>;
  riskFlags: string[];
  limits: {
    maxSinglePositionPct: number;
    maxGrossExposurePct: number;
    maxOpenOrderPct: number;
    maxDailyLossPct: number;
  };
  storedSnapshot?: Record<string, unknown> | null;
};

export function buildPortfolioRiskReport({
  mode,
  account,
  positions,
  orders,
  maxDailyLossPct = 3,
}: {
  mode: BrokerMode;
  account: Record<string, unknown> | null;
  positions: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  maxDailyLossPct?: number;
}): PortfolioRiskReport {
  const equity = numberField(account, "equity");
  const cash = numberField(account, "cash");
  const buyingPower = numberField(account, "buying_power");
  const marketValue = numberField(account, "portfolio_value") ?? numberField(account, "long_market_value");
  const lastEquity = numberField(account, "last_equity");
  const dailyPnl = equity !== null && lastEquity !== null ? Number((equity - lastEquity).toFixed(2)) : null;
  const dailyPnlPct = equity !== null && lastEquity && lastEquity > 0 ? Number((((equity - lastEquity) / lastEquity) * 100).toFixed(4)) : null;
  const enriched = positions.map((position): PortfolioRiskReport["concentration"][number] => {
    const symbol = textField(position, "symbol");
    const side: "long" | "short" = textField(position, "side") === "short" ? "short" : "long";
    const value = Math.abs(numberField(position, "market_value") ?? 0);
    return {
      symbol,
      side,
      marketValue: value,
      pctOfEquity: equity && equity > 0 ? Number(((value / equity) * 100).toFixed(2)) : 0,
      unrealizedPnl: numberField(position, "unrealized_pl") ?? 0,
    };
  });
  const longExposure = enriched.filter((item) => item.side === "long").reduce((sum, item) => sum + item.marketValue, 0);
  const shortExposure = enriched.filter((item) => item.side === "short").reduce((sum, item) => sum + item.marketValue, 0);
  const grossExposure = longExposure + shortExposure;
  const netExposure = longExposure - shortExposure;
  const openOrdersNotional = orders.reduce((sum, order) => sum + orderNotional(order), 0);
  const concentration = [...enriched].sort((a, b) => b.pctOfEquity - a.pctOfEquity).slice(0, 8);
  const limits = {
    maxSinglePositionPct: 25,
    maxGrossExposurePct: 150,
    maxOpenOrderPct: 35,
    maxDailyLossPct,
  };
  const riskFlags = [
    concentration.some((item) => item.pctOfEquity > limits.maxSinglePositionPct) ? "Single-position concentration is above the configured limit." : "",
    equity && equity > 0 && (grossExposure / equity) * 100 > limits.maxGrossExposurePct ? "Gross exposure is above the configured limit." : "",
    equity && equity > 0 && (openOrdersNotional / equity) * 100 > limits.maxOpenOrderPct ? "Open order notional is high relative to equity." : "",
    dailyPnlPct !== null && dailyPnlPct <= -limits.maxDailyLossPct ? "Daily loss limit has been breached. Stop new risk." : "",
    positions.length === 0 ? "No broker positions are open." : "",
  ].filter(Boolean);

  return {
    mode,
    equity,
    cash,
    buyingPower,
    marketValue,
    dailyPnl,
    dailyPnlPct,
    grossExposure: Number(grossExposure.toFixed(2)),
    netExposure: Number(netExposure.toFixed(2)),
    longExposure: Number(longExposure.toFixed(2)),
    shortExposure: Number(shortExposure.toFixed(2)),
    openOrdersNotional: Number(openOrdersNotional.toFixed(2)),
    concentration,
    riskFlags,
    limits,
  };
}

export async function storePortfolioRiskReport({
  report,
  account,
  positions,
  orders,
}: {
  report: PortfolioRiskReport;
  account: Record<string, unknown> | null;
  positions: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
}) {
  if (!databaseConfigured()) return null;
  return insertPortfolioRiskSnapshot({
    mode: report.mode,
    equity: report.equity,
    cash: report.cash,
    buyingPower: report.buyingPower,
    marketValue: report.marketValue,
    dailyPnl: report.dailyPnl,
    dailyPnlPct: report.dailyPnlPct,
    grossExposure: report.grossExposure,
    netExposure: report.netExposure,
    concentration: report.concentration,
    riskFlags: report.riskFlags,
    account,
    positions,
    orders,
  });
}

export async function recentPortfolioRiskSnapshots(limit = 25) {
  if (!databaseConfigured()) return [];
  return listPortfolioRiskSnapshots(limit);
}

function orderNotional(order: Record<string, unknown>) {
  const qty = numberField(order, "qty") ?? numberField(order, "notional") ?? 0;
  const limit = numberField(order, "limit_price") ?? numberField(order, "stop_price") ?? 0;
  if (numberField(order, "notional") !== null) return Math.abs(numberField(order, "notional") ?? 0);
  return Math.abs(qty * limit);
}

function numberField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function textField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}
