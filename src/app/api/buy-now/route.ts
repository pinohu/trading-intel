import { NextResponse } from "next/server";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const minConfidence = parseNumberParam(url.searchParams.get("minConfidence"), 70, 1, 100);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const result = generateBuyNowSignals({
    quotes: market.quotes ?? [],
    accountSize,
    riskPct,
    maxDailyLossPct,
    minConfidence,
  });

  return NextResponse.json({
    ...result,
    degraded: market.degraded ?? !ok,
    error: ok ? undefined : market.error ?? "Market data unavailable",
    liveTradingEnabled: false,
    advisory:
      "Buy-now candidates mean the app's strict research rules are currently aligned. They are not broker orders, guarantees, or personalized financial advice.",
  }, { status: ok ? 200 : status });
}
