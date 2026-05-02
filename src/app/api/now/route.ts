import { NextResponse } from "next/server";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { explainPlain, generateBuyLeads, generateSignals } from "@/lib/signalEngine";

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
  const signals = generateSignals(quotes, riskPct);
  const buyLeads = generateBuyLeads(quotes, riskPct);
  const buyNow = generateBuyNowSignals({
    quotes,
    accountSize,
    riskPct,
    maxDailyLossPct,
  });
  const buy = signals.find((signal) => signal.action === "Buy Watch");
  const sell = signals.find((signal) => signal.action === "Sell/Exit Watch");
  const fallback = signals[0];
  const topBuyLead = buyLeads.find((lead) => lead.status !== "No Buy") ?? buyLeads[0] ?? null;

  return NextResponse.json({
    asOf: new Date().toISOString(),
    dataIsExecutionGrade: quotes.length > 0 && quotes.every((quote) => quote.quality === "Execution Grade"),
    dataWarning: signals.some((signal) => !signal.dataFresh)
      ? "Some quotes are stale. Stale quotes are forced to Hold/No Trade."
      : "This app currently uses delayed/public quote data unless a licensed real-time provider is configured.",
    degraded: market.degraded ?? !ok,
    error: ok ? undefined : market.error ?? "Market data unavailable",
    staleSymbols: signals.filter((signal) => !signal.dataFresh).map((signal) => ({
      symbol: signal.symbol,
      ageMinutes: signal.dataAgeMinutes,
      sourceWarning: signal.warnings.find((warning) => warning.includes("Data is stale")),
    })),
    buyNow: buyNow.buyNow,
    buyNowBlocked: buyNow.blocked,
    buy: buy ? { signal: buy, plain: explainPlain(buy) } : null,
    buyLead: topBuyLead,
    sell: sell ? { signal: sell, plain: explainPlain(sell) } : null,
    top: fallback ? { signal: fallback, plain: explainPlain(fallback) } : null,
  }, { status: ok ? 200 : status });
}
