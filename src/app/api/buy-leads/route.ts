import { NextResponse } from "next/server";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { generateBuyLeads } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const buyLeads = generateBuyLeads(market.quotes ?? [], riskPct);

  return NextResponse.json({
    asOf: new Date().toISOString(),
    buyLeads,
    topBuyLead: buyLeads.find((lead) => lead.status !== "No Buy") ?? buyLeads[0] ?? null,
    degraded: market.degraded ?? !ok,
    error: ok ? undefined : market.error ?? "Market data unavailable",
    advisory: "Buy leads are ranked research prompts. Wait for the trigger and verify news/risk before acting.",
  }, { status: ok ? 200 : status });
}
