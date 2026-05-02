import { NextResponse } from "next/server";
import { buildAgentTradeProposals, buildAgentTradingPolicy } from "@/lib/agentTrader";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = modeFromRequest(request);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 24);
  const provider = parseProvider(url.searchParams.get("provider"));
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const policy = buildAgentTradingPolicy(mode);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const result = generateBuyNowSignals({
    quotes: market.quotes ?? [],
    accountSize,
    riskPct,
    maxDailyLossPct,
    minConfidence: policy.minConfidence,
  });
  const tickets = result.buyNow.map((signal) => signal.ticket);
  const proposals = buildAgentTradeProposals({
    buyNow: result.buyNow,
    tickets,
    mode,
    minConfidence: policy.minConfidence,
    maxProposals: policy.maxProposals,
  });

  return NextResponse.json(
    {
      ok,
      mode,
      policy,
      proposals,
      blocked: result.blocked,
      degraded: market.degraded ?? !ok,
      error: ok ? undefined : market.error ?? "Market data unavailable",
      advisory:
        mode === "live"
          ? "Live proposals are drafts only. A human must approve through the broker execution rail."
          : "Paper proposals can be auto-submitted only when agent paper automation is explicitly enabled.",
    },
    { status: ok ? 200 : status },
  );
}
