import { NextResponse } from "next/server";
import { buildAgentTradeProposals, buildAgentTradingPolicy } from "@/lib/agentTrader";
import { brokerReadiness } from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { getTradingControlState } from "@/lib/executionControl";
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
  const [controls, liveReadiness] = await Promise.all([
    getTradingControlState(),
    brokerReadiness("live"),
  ]);
  const policy = buildAgentTradingPolicy(mode, {
    controls,
    liveOrderPlacementReady: liveReadiness.orderPlacementReady,
  });
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
    liveAutonomyAllowed: policy.liveAutonomyAllowed,
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
          ? policy.liveAutonomyAllowed
            ? "Live proposals can be submitted by a logged-in operator when the live acknowledgement phrase and pre-trade controls pass."
            : "Live proposals are drafts until live-agent trading is armed with broker readiness, acknowledgement, and controls."
          : "Paper proposals can be auto-submitted when Alpaca paper execution is ready.",
    },
    { status: ok ? 200 : status },
  );
}
