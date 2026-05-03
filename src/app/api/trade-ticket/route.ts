import { NextResponse } from "next/server";
import { safeMirrorAitableRecords, tradeTicketToAitableRecord } from "@/lib/aitable";
import { databaseConfigured } from "@/lib/db";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertTradeTicket } from "@/lib/persistence";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { hasValidUserSession } from "@/lib/security";
import { generateBuyLeads, generateSignals } from "@/lib/signalEngine";
import { buildBuyTradeTicket, buildSellProtectionTicket, type TradeTicket } from "@/lib/tradeTicket";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const quotes = market.quotes ?? [];
  const buyLeads = generateBuyLeads(quotes, riskPct);
  const signals = generateSignals(quotes, riskPct);
  const lead = (symbol ? buyLeads.find((item) => item.symbol === symbol) : buyLeads.find((item) => item.status !== "No Buy")) ?? buyLeads[0];
  const sellSignal = (symbol ? signals.find((item) => item.symbol === symbol && item.action === "Sell/Exit Watch") : signals.find((item) => item.action === "Sell/Exit Watch"));

  return NextResponse.json({
    asOf: new Date().toISOString(),
    buyTicket: lead
      ? buildBuyTradeTicket({
          lead,
          accountSize,
          riskPct,
          maxDailyLossPct,
        })
      : null,
    sellProtectionTicket: buildSellProtectionTicket(sellSignal),
    degraded: market.degraded ?? !ok,
    error: ok ? undefined : market.error ?? "Market data unavailable",
    liveTradingEnabled: false,
    advisory: "Trade tickets are planning artifacts. They do not place orders.",
  }, { status: ok ? 200 : status });
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to save trade tickets." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { ticket?: TradeTicket; signalSnapshotId?: string } | null;
  if (!validTradeTicket(body?.ticket)) {
    return NextResponse.json({ ok: false, error: "A valid trade ticket is required." }, { status: 400 });
  }

  let tradeTicketId: string | null = null;
  let postgresError: string | null = null;
  if (databaseConfigured()) {
    try {
      tradeTicketId = await insertTradeTicket(body.ticket, body.signalSnapshotId ?? null);
    } catch (error) {
      postgresError = error instanceof Error ? error.message : "Trade-ticket storage is unavailable.";
    }
  } else {
    postgresError = "DATABASE_URL is not configured.";
  }

  const mirror = await safeMirrorAitableRecords("tradeTickets", [tradeTicketToAitableRecord(body.ticket)]);
  if (!tradeTicketId && !mirror.ok) {
    return NextResponse.json({ ok: false, error: postgresError ?? mirror.error ?? "Trade-ticket storage is unavailable." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    tradeTicketId,
    storage: {
      postgres: { ok: Boolean(tradeTicketId), error: postgresError },
      aitable: mirror,
    },
  }, { status: 201 });
}

function validTradeTicket(value: unknown): value is TradeTicket {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TradeTicket>;
  return (
    typeof item.symbol === "string" &&
    /^[A-Z0-9.=^-]{1,14}$/.test(item.symbol) &&
    (item.side === "Buy" || item.side === "Sell / Avoid") &&
    typeof item.status === "string" &&
    finiteNumber(item.trigger) &&
    finiteNumber(item.entry) &&
    typeof item.entrySignalNeeded === "string" &&
    finiteNumber(item.stop) &&
    finiteNumber(item.target) &&
    Number.isInteger(item.units) &&
    finiteNumber(item.notional) &&
    Number.isInteger(item.potentialUnits) &&
    finiteNumber(item.potentialNotional) &&
    finiteNumber(item.maxLoss) &&
    finiteNumber(item.rewardRisk) &&
    finiteNumber(item.riskRewardRatio) &&
    finiteNumber(item.riskPct) &&
    finiteNumber(item.riskBudgetDollars) &&
    finiteNumber(item.dailyLossCapDollars) &&
    finiteNumber(item.unitRisk) &&
    typeof item.positionSize === "string" &&
    typeof item.suggestedPositionSize === "string" &&
    typeof item.tradeable === "boolean" &&
    typeof item.reason === "string" &&
    Array.isArray(item.mustConfirm) &&
    Array.isArray(item.doNotTradeIf)
  );
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}
