import { NextResponse } from "next/server";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam } from "@/lib/requestGuards";
import { generateBuyLead, generateSignal } from "@/lib/signalEngine";
import { buildBuyTradeTicket, buildSellProtectionTicket } from "@/lib/tradeTicket";

export const dynamic = "force-dynamic";

const commodityExecutionMap: Record<string, { executable: string; name: string; note: string }> = {
  GOLD: { executable: "GLD", name: "Gold ETF", note: "Alpaca can route the ETF proxy, not CME gold futures." },
  SILVER: { executable: "SLV", name: "Silver ETF", note: "Alpaca can route the ETF proxy, not CME silver futures." },
  OIL: { executable: "USO", name: "Oil ETF", note: "Alpaca can route the ETF proxy, not NYMEX crude futures." },
  NATGAS: { executable: "UNG", name: "Natural Gas ETF", note: "Alpaca can route the ETF proxy, not Henry Hub futures." },
  COPPER: { executable: "CPER", name: "Copper ETF", note: "Alpaca can route the ETF proxy, not COMEX copper futures." },
  CORN: { executable: "DBA", name: "Agriculture ETF", note: "Alpaca can route a broad agriculture ETF proxy, not corn futures." },
  WHEAT: { executable: "DBA", name: "Agriculture ETF", note: "Alpaca can route a broad agriculture ETF proxy, not wheat futures." },
  SOY: { executable: "DBA", name: "Agriculture ETF", note: "Alpaca can route a broad agriculture ETF proxy, not soybean futures." },
  GLD: { executable: "GLD", name: "Gold ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
  SLV: { executable: "SLV", name: "Silver ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
  USO: { executable: "USO", name: "Oil ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
  UNG: { executable: "UNG", name: "Natural Gas ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
  DBA: { executable: "DBA", name: "Agriculture ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
  CPER: { executable: "CPER", name: "Copper ETF", note: "ETF is tradeable through the stock/ETF rail when broker permissions allow it." },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("symbol") ?? "GOLD").trim().toUpperCase();
  const mapping = commodityExecutionMap[requested];
  if (!mapping) {
    return NextResponse.json({ ok: false, error: `${requested} is not in the commodity workflow map.` }, { status: 400 });
  }

  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 0.5, 0, 2);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const symbols = Array.from(new Set([requested, mapping.executable]));
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbols.join(","));
  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json({ ok: false, error: market.error ?? "Commodity quote workflow failed." }, { status });
  }

  const quotes = market.quotes ?? [];
  const researchQuote = quotes.find((quote) => quote.symbol === requested) ?? quotes.find((quote) => quote.symbol === mapping.executable);
  const executableQuote = quotes.find((quote) => quote.symbol === mapping.executable) ?? researchQuote;
  if (!researchQuote || !executableQuote) {
    return NextResponse.json({ ok: false, error: "No usable commodity or ETF proxy quote was returned." }, { status: 503 });
  }

  const researchSignal = generateSignal(researchQuote, riskPct);
  const executableLead = generateBuyLead(executableQuote, riskPct);
  const buyTicket = buildBuyTradeTicket({ lead: executableLead, accountSize, riskPct, maxDailyLossPct });
  const sellProtectionTicket = buildSellProtectionTicket(researchSignal.action === "Sell/Exit Watch" ? researchSignal : undefined);

  return NextResponse.json({
    ok: true,
    requested,
    executableSymbol: mapping.executable,
    executableName: mapping.name,
    note: mapping.note,
    researchSignal,
    buyTicket,
    sellProtectionTicket,
    degraded: market.degraded ?? false,
    brokerRail: "Alpaca stock/ETF limit-order workflow",
    futuresExecutionReady: false,
    missingForFutures: ["Licensed futures data", "Futures broker credentials", "Contract calendar and roll engine"],
  });
}
