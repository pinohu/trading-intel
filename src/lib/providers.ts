import { getStockSnapshots } from "@/lib/broker";
import { getCachedQuote, setCachedQuote } from "@/lib/providerCache";

export type DataQuality = "Execution Grade" | "Public Real-Time" | "Partial Market" | "Unofficial" | "Delayed" | "Offline";

export type ProviderQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  source: string;
  quality: DataQuality;
  updatedAt: string;
  marketStatus?: string;
};

export const names: Record<string, string> = {
  AAPL: "Apple",
  AMD: "Advanced Micro Devices",
  AMZN: "Amazon",
  BTCUSD: "Bitcoin",
  COIN: "Coinbase",
  COPPER: "Copper Futures",
  CPER: "Copper ETF",
  CORN: "Corn Futures",
  DBA: "Agriculture ETF",
  ETHUSD: "Ethereum",
  GOOGL: "Alphabet",
  GLD: "Gold ETF",
  GOLD: "Gold Futures",
  META: "Meta",
  MSFT: "Microsoft",
  NATGAS: "Natural Gas Futures",
  NVDA: "NVIDIA",
  OIL: "Crude Oil Futures",
  PLTR: "Palantir",
  QQQ: "Nasdaq 100 ETF",
  SLV: "Silver ETF",
  SILVER: "Silver Futures",
  SMCI: "Super Micro Computer",
  SOY: "Soybean Futures",
  SPY: "S&P 500 ETF",
  TSLA: "Tesla",
  UNG: "Natural Gas ETF",
  USO: "Oil ETF",
  WHEAT: "Wheat Futures",
};

const commodityFutures: Record<string, string> = {
  COPPER: "HG=F",
  CORN: "ZC=F",
  GOLD: "GC=F",
  NATGAS: "NG=F",
  OIL: "CL=F",
  SILVER: "SI=F",
  SOY: "ZS=F",
  WHEAT: "ZW=F",
};

function quoteOk(quote: ProviderQuote | null): quote is ProviderQuote {
  return Boolean(quote && Number.isFinite(quote.price) && quote.price > 0);
}

function asStooq(symbol: string) {
  const clean = symbol.trim().toLowerCase();
  return clean.includes(".") ? clean : `${clean}.us`;
}

function isCommodityFutureAlias(symbol: string) {
  return Boolean(commodityFutures[symbol]);
}

function yahooRange(symbol: string) {
  if (commodityFutures[symbol]) return commodityFutures[symbol];
  const crypto = symbol === "BTCUSD" ? "BTC-USD" : symbol === "ETHUSD" ? "ETH-USD" : symbol;
  return crypto;
}

function yahooPathSymbol(symbol: string) {
  return encodeURIComponent(symbol).replace(/%3D/gi, "=");
}

function binanceSymbol(symbol: string) {
  if (symbol === "BTCUSD") return "BTCUSDT";
  if (symbol === "ETHUSD") return "ETHUSDT";
  return "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  return Number(value.replace(/[$,%\s,]/g, ""));
}

function hasUsableRange(quote: ProviderQuote | null): quote is ProviderQuote {
  if (!quoteOk(quote)) return false;
  return Number.isFinite(quote.high) && Number.isFinite(quote.low) && quote.high - quote.low >= Math.max(quote.price * 0.001, 0.02);
}

function parseDayRange(value: unknown) {
  if (typeof value !== "string") return null;
  const [lowRaw, highRaw] = value.replace(/\$/g, "").split(/\s*-\s*/);
  const low = parseNumber(lowRaw);
  const high = parseNumber(highRaw);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;
  return { low, high };
}

function nyTimestampToIso(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value.replace(" ET", " -0400"));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

async function providerFetch(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1] = {}) {
  const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? "3500");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 3500);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function fallbackQuote(symbol: string, index: number): ProviderQuote {
  const base = 90 + symbol.charCodeAt(0) * 1.4 + index * 18;
  const drift = ((symbol.charCodeAt(symbol.length - 1) % 11) - 5) * 0.72;
  return {
    symbol,
    name: names[symbol] ?? symbol,
    price: Number((base + drift).toFixed(2)),
    change: Number(drift.toFixed(2)),
    changePct: Number(((drift / base) * 100).toFixed(2)),
    open: Number(base.toFixed(2)),
    high: Number((base + Math.abs(drift) + 2.3).toFixed(2)),
    low: Number((base - Math.abs(drift) - 2.1).toFixed(2)),
    volume: 1000000 + index * 875000,
    source: "Offline fallback",
    quality: "Offline",
    updatedAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  };
}

export async function fetchStooqQuote(symbol: string): Promise<ProviderQuote | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(asStooq(symbol))}&f=sd2t2ohlcv&h&e=csv`;
  const response = await providerFetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
  const [symbolRaw, date, time, openRaw, highRaw, lowRaw, closeRaw, volumeRaw] = rows[0]?.split(",") ?? [];
  const price = Number(closeRaw);
  const open = Number(openRaw);
  if (!Number.isFinite(price) || price <= 0) return null;
  const change = price - open;
  return {
    symbol,
    name: names[symbol] ?? symbolRaw?.replace(".US", "") ?? symbol,
    price,
    change,
    changePct: open ? (change / open) * 100 : 0,
    open,
    high: Number(highRaw),
    low: Number(lowRaw),
    volume: Number(volumeRaw),
    source: "Stooq delayed quote",
    quality: "Delayed",
    updatedAt: `${date} ${time} ET`,
  };
}

export async function fetchYahooQuote(symbol: string): Promise<ProviderQuote | null> {
  const yahooSymbol = yahooRange(symbol);
  const commodityFuture = isCommodityFutureAlias(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooPathSymbol(yahooSymbol)}?range=1d&interval=1m&includePrePost=true`;
  const response = await providerFetch(url, {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 trading-intel-platform" },
  });
  if (!response.ok) return null;
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closeValues: Array<number | null> = quote?.close ?? [];
  const latestIndex = closeValues.findLastIndex((value) => Number.isFinite(value));
  const price = Number(closeValues[latestIndex] ?? meta?.regularMarketPrice);
  const open = Number(meta?.regularMarketOpen ?? quote?.open?.find((value: number | null) => Number.isFinite(value)) ?? price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const high = Math.max(...(quote?.high ?? []).filter((value: number | null) => Number.isFinite(value)));
  const low = Math.min(...(quote?.low ?? []).filter((value: number | null) => Number.isFinite(value)));
  const volume = (quote?.volume ?? []).reduce((sum: number, value: number | null) => sum + (Number(value) || 0), 0);
  return {
    symbol,
    name: names[symbol] ?? meta?.shortName ?? meta?.symbol ?? symbol,
    price,
    change: price - open,
    changePct: open ? ((price - open) / open) * 100 : 0,
    open,
    high: Number.isFinite(high) ? high : price,
    low: Number.isFinite(low) ? low : price,
    volume,
    source: commodityFuture ? "Yahoo commodity futures chart" : "Yahoo chart endpoint",
    quality: "Unofficial",
    updatedAt: timestamps[latestIndex] ? new Date(timestamps[latestIndex] * 1000).toISOString() : new Date().toISOString(),
    marketStatus: meta?.marketState,
  };
}

export async function fetchCnbcQuote(symbol: string): Promise<ProviderQuote | null> {
  if (symbol.endsWith("USD") || isCommodityFutureAlias(symbol)) return null;
  const response = await providerFetch(
    `https://quote.cnbc.com/quote-html-webservice/quote.htm?symbols=${encodeURIComponent(
      symbol,
    )}&requestMethod=quick&noform=1&partnerId=2&fund=1&exthrs=1&output=json`,
    {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 trading-intel-platform" },
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const item = data?.QuickQuoteResult?.QuickQuote?.[0];
  const price = parseNumber(item?.last);
  const open = parseNumber(item?.open);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    name: item?.name ?? names[symbol] ?? symbol,
    price,
    change: parseNumber(item?.change),
    changePct: parseNumber(item?.change_pct),
    open: Number.isFinite(open) ? open : price,
    high: parseNumber(item?.high),
    low: parseNumber(item?.low),
    volume: parseNumber(item?.fullVolume ?? item?.volume),
    source: "CNBC public quote",
    quality: "Public Real-Time",
    updatedAt: item?.last_time ? new Date(item.last_time).toISOString() : new Date().toISOString(),
    marketStatus: item?.marketStatus,
  };
}

export async function fetchNasdaqQuote(symbol: string): Promise<ProviderQuote | null> {
  if (symbol.endsWith("USD") || isCommodityFutureAlias(symbol)) return null;
  const response = await providerFetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 trading-intel-platform",
      origin: "https://www.nasdaq.com",
      referer: `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}`,
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const primary = data?.data?.primaryData;
  const dayRange = parseDayRange(data?.data?.keyStats?.dayrange?.value);
  const price = parseNumber(primary?.lastSalePrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const change = parseNumber(primary?.netChange);
  const changePct = parseNumber(primary?.percentageChange);
  return {
    symbol,
    name: data?.data?.companyName ?? names[symbol] ?? symbol,
    price,
    change,
    changePct,
    open: Number.isFinite(price - change) ? price - change : price,
    high: dayRange?.high ?? price,
    low: dayRange?.low ?? price,
    volume: parseNumber(primary?.volume),
    source: primary?.isRealTime ? "Nasdaq public quote real-time flag" : "Nasdaq public quote",
    quality: primary?.isRealTime ? "Public Real-Time" : "Unofficial",
    updatedAt: nyTimestampToIso(primary?.lastTradeTimestamp),
    marketStatus: data?.data?.marketStatus,
  };
}

export async function fetchCompositeStockQuote(symbol: string): Promise<ProviderQuote | null> {
  if (symbol.endsWith("USD") || isCommodityFutureAlias(symbol)) return null;
  const results = await Promise.allSettled([
    fetchNasdaqQuote(symbol),
    fetchCnbcQuote(symbol),
    fetchYahooQuote(symbol),
  ]);
  const [nasdaq, cnbc, yahoo] = results.map((result) => (result.status === "fulfilled" ? result.value : null));
  const primary = quoteOk(nasdaq) ? nasdaq : quoteOk(cnbc) ? cnbc : quoteOk(yahoo) ? yahoo : null;
  if (!primary) return null;
  const rangeQuote = hasUsableRange(cnbc) ? cnbc : hasUsableRange(nasdaq) ? nasdaq : hasUsableRange(yahoo) ? yahoo : primary;
  const open = Number.isFinite(rangeQuote.open) && rangeQuote.open > 0 ? rangeQuote.open : primary.open;
  const high = Number.isFinite(rangeQuote.high) && rangeQuote.high > 0 ? Math.max(rangeQuote.high, primary.price, open) : primary.price;
  const low = Number.isFinite(rangeQuote.low) && rangeQuote.low > 0 ? Math.min(rangeQuote.low, primary.price, open) : primary.price;
  const volume = Math.max(Number(primary.volume) || 0, Number(rangeQuote.volume) || 0);

  return {
    ...primary,
    name: primary.name || rangeQuote.name || names[symbol] || symbol,
    open,
    high,
    low,
    volume,
    source: primary.source === rangeQuote.source ? primary.source : `${primary.source} + ${rangeQuote.source} range`,
    quality: primary.quality === "Public Real-Time" || rangeQuote.quality === "Public Real-Time" ? "Public Real-Time" : primary.quality,
    marketStatus: primary.marketStatus ?? rangeQuote.marketStatus,
  };
}

export async function fetchCommodityFutureQuote(symbol: string): Promise<ProviderQuote | null> {
  if (!isCommodityFutureAlias(symbol)) return null;
  return fetchYahooQuote(symbol);
}

export async function fetchBinanceQuote(symbol: string): Promise<ProviderQuote | null> {
  const pair = binanceSymbol(symbol);
  if (!pair) return null;
  const response = await providerFetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  const price = Number(data.lastPrice);
  const open = Number(data.openPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    name: names[symbol] ?? symbol,
    price,
    change: Number(data.priceChange),
    changePct: Number(data.priceChangePercent),
    open,
    high: Number(data.highPrice),
    low: Number(data.lowPrice),
    volume: Number(data.volume),
    source: "Binance public crypto",
    quality: "Partial Market",
    updatedAt: new Date(Number(data.closeTime) || Date.now()).toISOString(),
  };
}

export async function fetchAlpacaQuote(symbol: string): Promise<ProviderQuote | null> {
  if (symbol.endsWith("USD") || isCommodityFutureAlias(symbol)) return null;
  const data = await getStockSnapshots([symbol], undefined, process.env.ALPACA_DATA_QUALITY === "sip" ? "sip" : "iex").catch(() => null);
  const snapshots = data as { snapshots?: Record<string, { latestTrade?: { p?: number; t?: string }; dailyBar?: { o?: number; h?: number; l?: number; v?: number } }> } | null;
  const snapshot = snapshots?.snapshots?.[symbol];
  const tradePrice = Number(snapshot?.latestTrade?.p);
  const daily = snapshot?.dailyBar;
  const open = Number(daily?.o ?? tradePrice);
  if (!Number.isFinite(tradePrice) || tradePrice <= 0) return null;
  return {
    symbol,
    name: names[symbol] ?? symbol,
    price: tradePrice,
    change: tradePrice - open,
    changePct: open ? ((tradePrice - open) / open) * 100 : 0,
    open,
    high: Number(daily?.h ?? tradePrice),
    low: Number(daily?.l ?? tradePrice),
    volume: Number(daily?.v ?? 0),
    source: "Alpaca market data",
    quality: process.env.ALPACA_DATA_QUALITY === "sip" ? "Execution Grade" : "Partial Market",
    updatedAt: snapshot?.latestTrade?.t ?? new Date().toISOString(),
  };
}

export async function fetchPolygonQuote(symbol: string): Promise<ProviderQuote | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || symbol.endsWith("USD") || isCommodityFutureAlias(symbol)) return null;
  const response = await providerFetch(
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const ticker = data?.ticker;
  const day = ticker?.day ?? {};
  const previousDay = ticker?.prevDay ?? {};
  const lastTrade = ticker?.lastTrade ?? {};
  const price = Number(lastTrade.p ?? day.c ?? previousDay.c);
  const open = Number(day.o ?? previousDay.c ?? price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const previousClose = Number(previousDay.c ?? open);
  const change = price - previousClose;
  return {
    symbol,
    name: names[symbol] ?? symbol,
    price,
    change,
    changePct: previousClose ? (change / previousClose) * 100 : 0,
    open,
    high: Number(day.h ?? price),
    low: Number(day.l ?? price),
    volume: Number(day.v ?? 0),
    source: "Polygon.io stock snapshot",
    quality: "Execution Grade",
    updatedAt: lastTrade.t ? new Date(Number(lastTrade.t) / 1_000_000).toISOString() : new Date().toISOString(),
    marketStatus: data?.status,
  };
}

export async function fetchTwelveDataQuote(symbol: string): Promise<ProviderQuote | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey || isCommodityFutureAlias(symbol)) return null;
  const twelveSymbol = symbol === "BTCUSD" ? "BTC/USD" : symbol === "ETHUSD" ? "ETH/USD" : symbol;
  const response = await providerFetch(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(twelveSymbol)}&apikey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const data = await response.json();
  if (data?.status === "error") return null;
  const price = Number(data.close ?? data.price);
  const open = Number(data.open ?? price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    name: data.name ?? names[symbol] ?? symbol,
    price,
    change: Number(data.change ?? price - open),
    changePct: Number(data.percent_change ?? (open ? ((price - open) / open) * 100 : 0)),
    open,
    high: Number(data.high ?? price),
    low: Number(data.low ?? price),
    volume: Number(data.volume ?? 0),
    source: "Twelve Data quote",
    quality: symbol.endsWith("USD") ? "Partial Market" : "Partial Market",
    updatedAt: data.datetime ? new Date(data.datetime).toISOString() : new Date().toISOString(),
  };
}

type ProviderFn = (symbol: string) => Promise<ProviderQuote | null>;

const freeFirstProviderFns: ProviderFn[] = [
  fetchCommodityFutureQuote,
  fetchCompositeStockQuote,
  fetchBinanceQuote,
  fetchNasdaqQuote,
  fetchCnbcQuote,
  fetchYahooQuote,
  fetchStooqQuote,
];

const paidEnhancedProviderFns: ProviderFn[] = [
  fetchPolygonQuote,
  fetchAlpacaQuote,
  fetchTwelveDataQuote,
  ...freeFirstProviderFns,
];

function providerFns(preferredProvider: string): ProviderFn[] {
  switch (preferredProvider) {
    case "fallback":
      return [];
    case "paid":
      return paidEnhancedProviderFns;
    case "alpaca":
      return [fetchAlpacaQuote, ...freeFirstProviderFns];
    case "polygon":
      return [fetchPolygonQuote, ...freeFirstProviderFns];
    case "twelvedata":
      return [fetchTwelveDataQuote, ...freeFirstProviderFns];
    case "yahoo":
      return [fetchYahooQuote, fetchBinanceQuote, fetchStooqQuote];
    case "nasdaq":
      return [fetchCommodityFutureQuote, fetchNasdaqQuote, fetchCnbcQuote, fetchYahooQuote, fetchStooqQuote, fetchBinanceQuote];
    case "cnbc":
      return [fetchCommodityFutureQuote, fetchCnbcQuote, fetchNasdaqQuote, fetchYahooQuote, fetchStooqQuote, fetchBinanceQuote];
    case "binance":
      return [fetchBinanceQuote, fetchYahooQuote, fetchStooqQuote];
    case "stooq":
      return [fetchStooqQuote, fetchYahooQuote];
    case "free":
    case "auto":
    default:
      return freeFirstProviderFns;
  }
}

export function providerPlanNames(preferredProvider = "auto") {
  return providerFns(preferredProvider).map((provider) => provider.name);
}

export async function fetchProviderQuote(symbol: string, index: number, preferredProvider = "auto"): Promise<ProviderQuote | null> {
  if (preferredProvider === "fallback" || process.env.DEMO_MARKET_DATA === "true") {
    return fallbackQuote(symbol, index);
  }

  const providers = providerFns(preferredProvider);

  for (const provider of providers) {
    const cacheKey = `${provider.name}:${symbol}`;
    const cached = getCachedQuote(cacheKey);
    if (cached) return cached;
    const quote = await provider(symbol);
    if (quoteOk(quote)) {
      setCachedQuote(cacheKey, quote);
      return quote;
    }
  }
  return null;
}

export const providerCatalog = [
  { name: "Free-first auto", quality: "Default route: public stocks, public crypto, public futures aliases, delayed fallback", configured: true, cost: "free-default" },
  { name: "Composite public stock quote", quality: "Nasdaq price enriched with CNBC/Yahoo day range", configured: true, cost: "free-public" },
  { name: "Nasdaq public quote", quality: "Public Real-Time when endpoint flags it", configured: true, cost: "free-public" },
  { name: "CNBC public quote", quality: "Public Real-Time timestamped public quote", configured: true, cost: "free-public" },
  { name: "Yahoo commodity futures aliases", quality: "Unofficial futures research feed", configured: true, cost: "free-public" },
  { name: "Yahoo chart endpoint", quality: "Unofficial with pre/post enabled", configured: true, cost: "free-public" },
  { name: "Stooq", quality: "Delayed", configured: true, cost: "free-public" },
  { name: "Binance public crypto", quality: "Partial Market", configured: true, cost: "free-public" },
  { name: "Alpaca", quality: "Free Basic IEX / optional SIP if entitled", configured: Boolean(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY), cost: "free-account-or-paid-upgrade" },
  { name: "Polygon.io", quality: "Optional paid/entitled stock snapshot provider", configured: Boolean(process.env.POLYGON_API_KEY), cost: "optional-paid" },
  { name: "Twelve Data", quality: "Optional paid/plan-dependent quote provider", configured: Boolean(process.env.TWELVE_DATA_API_KEY), cost: "optional-paid" },
];
