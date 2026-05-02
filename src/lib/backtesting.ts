import { getStockBars, type BrokerMode } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { insertStrategyBacktest, listStrategyBacktests } from "@/lib/persistence";

type AlpacaBar = {
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

export type BacktestSymbolResult = {
  symbol: string;
  bars: number;
  trades: number;
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  status: "ok" | "insufficient-data" | "unsupported";
  validation?: Record<string, unknown> | null;
};

export type BacktestResult = {
  strategy: string;
  timeframe: string;
  lookbackDays: number;
  assumptions: {
    slippageBps: number;
    feeBps: number;
    maxHoldBars: number;
    stopPct: number;
    rewardRisk: number;
    validation?: {
      method: string;
      inSamplePct: number;
      outOfSamplePct: number;
      pointInTimeFundamentalPolicy: string;
    };
  };
  dataSource: string;
  results: BacktestSymbolResult[];
  metrics: {
    symbolsTested: number;
    trades: number;
    winRate: number;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
  };
  storedRun?: Record<string, unknown> | null;
};

const unsupportedBacktestSymbols = new Set(["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY", "BTCUSD", "ETHUSD"]);

export async function runMomentumBreakoutBacktest({
  symbols,
  lookbackDays,
  mode,
  slippageBps = 5,
  feeBps = 1,
  maxHoldBars = 5,
  stopPct = 2,
  rewardRisk = 2,
}: {
  symbols: string[];
  lookbackDays: number;
  mode?: BrokerMode;
  slippageBps?: number;
  feeBps?: number;
  maxHoldBars?: number;
  stopPct?: number;
  rewardRisk?: number;
}): Promise<BacktestResult> {
  const supported = symbols.filter((symbol) => !unsupportedBacktestSymbols.has(symbol));
  const unsupported = symbols
    .filter((symbol) => unsupportedBacktestSymbols.has(symbol))
    .map((symbol) => unsupportedResult(symbol));
  const barsBySymbol = supported.length
    ? await fetchDailyBars(supported, lookbackDays, mode)
    : new Map<string, AlpacaBar[]>();

  const results = [
    ...supported.map((symbol) =>
      backtestSymbol({
        symbol,
        bars: barsBySymbol.get(symbol) ?? [],
        slippageBps,
        feeBps,
        maxHoldBars,
        stopPct,
        rewardRisk,
      }),
    ),
    ...unsupported,
  ];
  const validationResults = buildWalkForwardValidation({
    symbols: supported,
    barsBySymbol,
    slippageBps,
    feeBps,
    maxHoldBars,
    stopPct,
    rewardRisk,
  });
  const metrics = aggregate(results);
  const payload: BacktestResult = {
    strategy: "daily-momentum-breakout",
    timeframe: "1Day",
    lookbackDays,
    assumptions: {
      slippageBps,
      feeBps,
      maxHoldBars,
      stopPct,
      rewardRisk,
      validation: {
        method: "70/30 chronological holdout",
        inSamplePct: 70,
        outOfSamplePct: 30,
        pointInTimeFundamentalPolicy: "This quote-only backtest does not use fundamentals. Fundamental factor backtests must use filed-date provenance before promotion.",
      },
    },
    dataSource: "Alpaca stock bars",
    results: results.map((result) => ({
      ...result,
      validation: validationResults.get(result.symbol) ?? null,
    })) as BacktestSymbolResult[],
    metrics,
  };

  if (databaseConfigured()) {
    payload.storedRun = await insertStrategyBacktest({
      strategy: payload.strategy,
      symbols,
      timeframe: payload.timeframe,
      lookbackDays,
      assumptions: payload.assumptions,
      metrics: payload.metrics,
      results: payload.results as unknown as Array<Record<string, unknown>>,
      dataSource: payload.dataSource,
      status: results.some((result) => result.status === "ok") ? "completed" : "no-trades",
    }).catch((error) => ({ error: error instanceof Error ? error.message : "Backtest storage failed" }));
  }

  return payload;
}

function buildWalkForwardValidation({
  symbols,
  barsBySymbol,
  slippageBps,
  feeBps,
  maxHoldBars,
  stopPct,
  rewardRisk,
}: {
  symbols: string[];
  barsBySymbol: Map<string, AlpacaBar[]>;
  slippageBps: number;
  feeBps: number;
  maxHoldBars: number;
  stopPct: number;
  rewardRisk: number;
}) {
  const result = new Map<string, Record<string, unknown>>();
  for (const symbol of symbols) {
    const bars = [...(barsBySymbol.get(symbol) ?? [])].sort((a, b) => String(a.t).localeCompare(String(b.t)));
    if (bars.length < 90) {
      result.set(symbol, { status: "insufficient-data", method: "70/30 chronological holdout" });
      continue;
    }
    const split = Math.floor(bars.length * 0.7);
    const common = { slippageBps, feeBps, maxHoldBars, stopPct, rewardRisk };
    const inSample = backtestSymbol({ symbol, bars: bars.slice(0, split), ...common });
    const outOfSample = backtestSymbol({ symbol, bars: bars.slice(split - 21), ...common });
    result.set(symbol, {
      status: "ok",
      method: "70/30 chronological holdout",
      inSample: {
        trades: inSample.trades,
        winRate: inSample.winRate,
        totalReturnPct: inSample.totalReturnPct,
        maxDrawdownPct: inSample.maxDrawdownPct,
      },
      outOfSample: {
        trades: outOfSample.trades,
        winRate: outOfSample.winRate,
        totalReturnPct: outOfSample.totalReturnPct,
        maxDrawdownPct: outOfSample.maxDrawdownPct,
      },
      robustness:
        outOfSample.trades > 0 && inSample.trades > 0
          ? Number((outOfSample.totalReturnPct - Math.max(0, inSample.maxDrawdownPct - outOfSample.maxDrawdownPct)).toFixed(4))
          : 0,
    });
  }
  return result;
}

export async function recentBacktests(limit = 25) {
  if (!databaseConfigured()) return [];
  return listStrategyBacktests(limit);
}

async function fetchDailyBars(symbols: string[], lookbackDays: number, mode?: BrokerMode) {
  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    timeframe: "1Day",
    start: start.toISOString(),
    end: end.toISOString(),
    adjustment: "split",
    feed: process.env.ALPACA_DATA_QUALITY === "sip" ? "sip" : "iex",
    limit: String(Math.max(50, Math.min(lookbackDays + 20, 1000))),
  });
  const data = await getStockBars(symbols, mode, query.toString());
  const bars = (data as { bars?: Record<string, AlpacaBar[]> }).bars ?? {};
  return new Map(Object.entries(bars).map(([symbol, items]) => [symbol, items.filter(validBar)]));
}

function backtestSymbol({
  symbol,
  bars,
  slippageBps,
  feeBps,
  maxHoldBars,
  stopPct,
  rewardRisk,
}: {
  symbol: string;
  bars: AlpacaBar[];
  slippageBps: number;
  feeBps: number;
  maxHoldBars: number;
  stopPct: number;
  rewardRisk: number;
}): BacktestSymbolResult {
  const sorted = [...bars].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  if (sorted.length < 30) {
    return { ...emptyMetrics(symbol, sorted.length), status: "insufficient-data" };
  }

  const returns: number[] = [];
  let equity = 100;
  let peak = equity;
  let maxDrawdownPct = 0;

  for (let index = 21; index < sorted.length - 1; index += 1) {
    const bar = sorted[index];
    const previous = sorted[index - 1];
    const sma20 = average(sorted.slice(index - 20, index).map((item) => Number(item.c)));
    const volumeAverage = average(sorted.slice(index - 20, index).map((item) => Number(item.v ?? 0)));
    const breakout = Number(bar.c) > Number(previous.h) && Number(bar.c) > sma20 && Number(bar.v ?? 0) >= volumeAverage * 0.8;
    if (!breakout) continue;

    const next = sorted[index + 1];
    const entry = Number(next.o) * (1 + slippageBps / 10_000);
    const stop = entry * (1 - stopPct / 100);
    const target = entry + (entry - stop) * rewardRisk;
    const exit = exitTrade(sorted.slice(index + 1, index + 1 + maxHoldBars), stop, target);
    const exitPrice = exit.price * (1 - slippageBps / 10_000);
    const tradeReturn = ((exitPrice - entry) / entry) * 100 - feeBps / 100;
    returns.push(Number(tradeReturn.toFixed(4)));
    equity *= 1 + tradeReturn / 100;
    peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
  }

  if (returns.length === 0) {
    return { ...emptyMetrics(symbol, sorted.length), status: "ok" };
  }

  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));

  return {
    symbol,
    bars: sorted.length,
    trades: returns.length,
    winRate: Number(((wins.length / returns.length) * 100).toFixed(2)),
    avgReturnPct: Number(average(returns).toFixed(4)),
    totalReturnPct: Number((equity - 100).toFixed(4)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(3)) : grossProfit > 0 ? 99 : 0,
    status: "ok",
  };
}

function exitTrade(bars: AlpacaBar[], stop: number, target: number) {
  for (const bar of bars) {
    if (Number(bar.l) <= stop) return { price: stop, reason: "stop" };
    if (Number(bar.h) >= target) return { price: target, reason: "target" };
  }
  const last = bars[bars.length - 1];
  return { price: Number(last?.c ?? stop), reason: "time" };
}

function aggregate(results: BacktestSymbolResult[]) {
  const usable = results.filter((result) => result.status === "ok");
  const trades = usable.reduce((sum, item) => sum + item.trades, 0);
  const weightedReturn = usable.reduce((sum, item) => sum + item.avgReturnPct * item.trades, 0);
  const totalReturnPct = usable.reduce((sum, item) => sum + item.totalReturnPct, 0);
  const wins = usable.reduce((sum, item) => sum + item.trades * (item.winRate / 100), 0);
  const maxDrawdownPct = Math.max(0, ...usable.map((item) => item.maxDrawdownPct));
  const profitFactors = usable.filter((item) => item.profitFactor > 0).map((item) => item.profitFactor);
  return {
    symbolsTested: usable.length,
    trades,
    winRate: trades ? Number(((wins / trades) * 100).toFixed(2)) : 0,
    avgReturnPct: trades ? Number((weightedReturn / trades).toFixed(4)) : 0,
    totalReturnPct: Number(totalReturnPct.toFixed(4)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
    profitFactor: profitFactors.length ? Number(average(profitFactors).toFixed(3)) : 0,
  };
}

function unsupportedResult(symbol: string): BacktestSymbolResult {
  return { ...emptyMetrics(symbol, 0), status: "unsupported" };
}

function emptyMetrics(symbol: string, bars: number): Omit<BacktestSymbolResult, "status"> {
  return {
    symbol,
    bars,
    trades: 0,
    winRate: 0,
    avgReturnPct: 0,
    totalReturnPct: 0,
    maxDrawdownPct: 0,
    profitFactor: 0,
  };
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function validBar(value: AlpacaBar) {
  return Number.isFinite(value.o) && Number.isFinite(value.h) && Number.isFinite(value.l) && Number.isFinite(value.c);
}
