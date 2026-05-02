import { NextResponse } from "next/server";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { generateBuyLeads, generateSignals } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const quotes = market.quotes ?? [];
  if (!ok) {
    return NextResponse.json(
      {
        signals: [],
        buyLeads: [],
        buyNow: generateBuyNowSignals({ quotes: [], accountSize, riskPct, maxDailyLossPct }),
        degraded: true,
        error: market.error ?? "Market data unavailable",
        liveTradingEnabled: false,
        advisory: "Rule-based research signals only. Not financial advice or autonomous trade execution.",
      },
      { status },
    );
  }

  return NextResponse.json({
    signals: generateSignals(quotes, riskPct),
    buyLeads: generateBuyLeads(quotes, riskPct),
    buyNow: generateBuyNowSignals({
      quotes,
      accountSize,
      riskPct,
      maxDailyLossPct,
    }),
    degraded: market.degraded ?? false,
    liveTradingEnabled: false,
    advisory: "Rule-based research signals only. Not financial advice or autonomous trade execution.",
  });
}
