import { NextResponse } from "next/server";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { optimizeTradeBasketFromLeads } from "@/lib/isingOptimizer";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { generateBuyLeads } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const provider = parseProvider(url.searchParams.get("provider"));
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const budget = parseNumberParam(url.searchParams.get("budget"), accountSize * 0.35, 1, accountSize);
  const maxRiskDollars = parseNumberParam(
    url.searchParams.get("maxRiskDollars"),
    accountSize * (maxDailyLossPct / 100),
    1,
    accountSize,
  );
  const maxPositions = Math.round(parseNumberParam(url.searchParams.get("maxPositions"), 3, 1, 8));
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json(
      { ok: false, degraded: true, error: market.error ?? "Market data unavailable", optimizer: null },
      { status },
    );
  }

  const buyLeads = generateBuyLeads(market.quotes ?? [], riskPct);
  const optimizer = optimizeTradeBasketFromLeads({
    buyLeads,
    accountSize,
    riskPct,
    maxDailyLossPct,
    budget,
    maxRiskDollars,
    maxPositions,
    seed: `${symbols.join("|")}|${budget}|${maxRiskDollars}|${maxPositions}`,
  });

  return NextResponse.json({
    ok: true,
    degraded: market.degraded ?? false,
    optimizer,
    advisory: "The Ising/QUBO optimizer chooses a basket from existing research leads. It does not predict prices or place orders.",
  });
}
