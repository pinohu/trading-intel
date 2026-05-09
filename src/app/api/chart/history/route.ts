import { NextResponse } from "next/server";
import { getStockBars } from "@/lib/broker";
import { brokerReadiness, parseBrokerMode, type BrokerMode } from "@/lib/broker";
import { fetchProviderQuote } from "@/lib/providers";
import { parseProvider } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

type ChartCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const timeframeMap: Record<string, { alpaca: string; limit: number; stepMinutes: number }> = {
  "1m": { alpaca: "1Min", limit: 120, stepMinutes: 1 },
  "5m": { alpaca: "5Min", limit: 120, stepMinutes: 5 },
  "15m": { alpaca: "15Min", limit: 120, stepMinutes: 15 },
  "1h": { alpaca: "1Hour", limit: 160, stepMinutes: 60 },
  "1D": { alpaca: "1Day", limit: 180, stepMinutes: 60 * 24 },
  "1W": { alpaca: "1Week", limit: 156, stepMinutes: 60 * 24 * 7 },
  "1M": { alpaca: "1Month", limit: 96, stepMinutes: 60 * 24 * 30 },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = cleanSymbol(url.searchParams.get("symbol") ?? "SPY");
  const timeframe = timeframeMap[url.searchParams.get("timeframe") ?? "1D"] ? url.searchParams.get("timeframe") ?? "1D" : "1D";
  const provider = parseProvider(url.searchParams.get("provider"));
  const mode = parseBrokerMode(url.searchParams.get("mode"));
  const config = timeframeMap[timeframe];

  if (!symbol) {
    return NextResponse.json({ ok: false, error: "A valid symbol is required.", candles: [] }, { status: 400 });
  }

  const readiness = await brokerReadiness(mode);
  if (readiness.credentialsConfigured && !symbol.endsWith("USD")) {
    const alpaca = await fetchAlpacaBars(symbol, mode, config.alpaca, config.limit);
    if (alpaca.length) {
      return NextResponse.json({
        ok: true,
        symbol,
        timeframe,
        source: "Alpaca historical bars",
        quality: readiness.dataQuality,
        candles: alpaca,
      });
    }
  }

  const quote = await fetchProviderQuote(symbol, 0, provider).catch(() => null);
  const fallback = buildProxyHistory({
    symbol,
    price: quote?.price ?? 100,
    open: quote?.open ?? quote?.price ?? 100,
    high: quote?.high ?? quote?.price ?? 102,
    low: quote?.low ?? quote?.price ?? 98,
    volume: quote?.volume ?? 1_000_000,
    count: Math.min(config.limit, 120),
    stepMinutes: config.stepMinutes,
  });

  return NextResponse.json({
    ok: true,
    symbol,
    timeframe,
    source: quote ? `${quote.source} proxy history` : "deterministic proxy history",
    quality: quote?.quality ?? "Offline",
    advisory: "Historical bars are proxy-generated until Alpaca market-data credentials are configured.",
    candles: fallback,
  });
}

async function fetchAlpacaBars(symbol: string, mode: BrokerMode, timeframe: string, limit: number) {
  const params = new URLSearchParams({
    timeframe,
    limit: String(limit),
    adjustment: "split",
    sort: "asc",
  });
  const payload = await getStockBars([symbol], mode, params.toString()).catch(() => null);
  const rawBars = (payload as { bars?: Record<string, unknown[]> } | null)?.bars?.[symbol] ?? [];
  return rawBars.map(normalizeAlpacaBar).filter((bar): bar is ChartCandle => Boolean(bar));
}

function normalizeAlpacaBar(value: unknown): ChartCandle | null {
  const bar = value as Record<string, unknown>;
  const open = Number(bar.o);
  const high = Number(bar.h);
  const low = Number(bar.l);
  const close = Number(bar.c);
  const volume = Number(bar.v ?? 0);
  const time = typeof bar.t === "string" ? bar.t : "";
  if (!time || ![open, high, low, close].every((item) => Number.isFinite(item) && item > 0)) return null;
  return { time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 };
}

function buildProxyHistory({
  symbol,
  price,
  open,
  high,
  low,
  volume,
  count,
  stepMinutes,
}: {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  count: number;
  stepMinutes: number;
}) {
  const seed = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const start = Date.now() - count * stepMinutes * 60_000;
  const base = Number.isFinite(open) && open > 0 ? open : price;
  const rangePct = Math.max(0.012, Math.min(0.12, Math.abs(high - low) / Math.max(price, 1)));
  let previous = base * (1 - rangePct * 0.35);

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + seed) / 5.2) * rangePct;
    const drift = ((index / Math.max(count - 1, 1)) - 0.5) * ((price - base) / Math.max(base, 1));
    const close = index === count - 1 ? price : base * (1 + wave + drift);
    const candleOpen = previous;
    const spread = Math.max(Math.abs(close - candleOpen), price * rangePct * (0.22 + (index % 7) * 0.025));
    const candleHigh = Math.max(candleOpen, close) + spread * 0.42;
    const candleLow = Math.max(0.01, Math.min(candleOpen, close) - spread * 0.42);
    previous = close;
    return {
      time: new Date(start + index * stepMinutes * 60_000).toISOString(),
      open: Number(candleOpen.toFixed(2)),
      high: Number(candleHigh.toFixed(2)),
      low: Number(candleLow.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.max(1, Math.round(volume * (0.18 + ((index + seed) % 13) / 24))),
    };
  });
}

function cleanSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9./_-]{1,24}$/.test(symbol) ? symbol : "";
}
