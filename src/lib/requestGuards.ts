export const defaultSymbols =
  "SPY,QQQ,NVDA,TSLA,AAPL,MSFT,AMD,COIN,GLD,SLV,USO,UNG,GOLD,SILVER,OIL,NATGAS,COPPER,CORN,WHEAT,SOY,BTCUSD,ETHUSD";

const allowedProviderNames = new Set(["auto", "free", "paid", "alpaca", "polygon", "twelvedata", "nasdaq", "cnbc", "yahoo", "binance", "stooq"]);
const symbolPattern = /^[A-Z0-9.=^-]{1,14}$/;

export function parseSymbols(value: string | null | undefined, max = 24) {
  const raw = value || defaultSymbols;
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbolPattern.test(symbol)),
    ),
  ).slice(0, max);
}

export function parseProvider(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase() || "auto";
  return allowedProviderNames.has(clean) ? clean : "auto";
}

export function parseNumberParam(value: string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function symbolsParam(symbols: string[]) {
  return symbols.join(",");
}
