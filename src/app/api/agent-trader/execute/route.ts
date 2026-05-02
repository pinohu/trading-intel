import { NextResponse } from "next/server";
import { buildAgentTradeProposals, buildAgentTradingPolicy } from "@/lib/agentTrader";
import { recordAuditEvent } from "@/lib/audit";
import { brokerConfig, brokerReadiness, insertBrokerOrderEvent, submitAlpacaOrder, validateBrokerOrderPayload } from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { evaluatePreTradeControls } from "@/lib/executionControl";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized agent-trader request." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as {
    symbol?: string;
    symbols?: string;
    provider?: string;
    accountSize?: number;
    riskPct?: number;
    maxDailyLossPct?: number;
  };
  const policy = buildAgentTradingPolicy(mode);
  const url = new URL(request.url);
  const symbols = parseSymbols(body.symbols ?? body.symbol ?? url.searchParams.get("symbols"), 24);
  const provider = parseProvider(body.provider ?? url.searchParams.get("provider"));
  const accountSizeValue = body.accountSize === undefined ? url.searchParams.get("accountSize") : String(body.accountSize);
  const riskPctValue = body.riskPct === undefined ? url.searchParams.get("riskPct") : String(body.riskPct);
  const maxDailyLossValue = body.maxDailyLossPct === undefined ? url.searchParams.get("maxDailyLossPct") : String(body.maxDailyLossPct);
  const accountSize = parseNumberParam(accountSizeValue, 10000, 100, 100000000);
  const riskPct = parseNumberParam(riskPctValue, 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(maxDailyLossValue, 3, 0.1, 20);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json({ ok: false, mode, error: market.error ?? "Market data unavailable." }, { status });
  }

  const buyNow = generateBuyNowSignals({
    quotes: market.quotes ?? [],
    accountSize,
    riskPct,
    maxDailyLossPct,
    minConfidence: policy.minConfidence,
  });
  const proposals = buildAgentTradeProposals({
    buyNow: buyNow.buyNow,
    tickets: buyNow.buyNow.map((signal) => signal.ticket),
    mode,
    minConfidence: policy.minConfidence,
    maxProposals: policy.maxProposals,
  });
  const requestedSymbol = body.symbol?.trim().toUpperCase();
  const proposal = requestedSymbol ? proposals.find((item) => item.symbol === requestedSymbol) : proposals[0];
  if (!proposal) {
    return NextResponse.json({
      ok: false,
      mode,
      policy,
      error: "No agent-trade proposal currently passes the strict buy-now gate.",
      blocked: buyNow.blocked,
    }, { status: 409 });
  }

  await recordAuditEvent("agent_trade.proposed", null, {
    symbol: proposal.symbol,
    mode,
    confidence: proposal.confidence,
    status: proposal.status,
  });

  if (mode === "live") {
    await recordAuditEvent("agent_trade.live_blocked", null, {
      symbol: proposal.symbol,
      confidence: proposal.confidence,
    });
    return NextResponse.json(
      {
        ok: false,
        mode,
        proposal,
        error: "Live-money agent execution is blocked. Review the draft and place it manually through the broker execution rail if you choose.",
        manualApprovalRequired: true,
      },
      { status: 409 },
    );
  }

  if (!policy.paperAutomationReady) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        proposal,
        policy,
        error: "Agent paper trading is not enabled or broker paper execution is not ready.",
      },
      { status: 503 },
    );
  }

  const readiness = await brokerReadiness("paper");
  if (!readiness.orderPlacementReady) {
    return NextResponse.json({ ok: false, mode, proposal, readiness, error: "Paper broker execution is not ready." }, { status: 503 });
  }

  const validation = validateBrokerOrderPayload(proposal.orderDraft, brokerConfig("paper"));
  if (!validation.ok) {
    return NextResponse.json({ ok: false, mode, proposal, error: validation.error }, { status: 400 });
  }

  const preTrade = await evaluatePreTradeControls({ mode: "paper", order: validation.order });
  if (!preTrade.ok) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        proposal,
        error: "Pre-trade controls blocked this agent paper order.",
        blockers: preTrade.blockers,
        warnings: preTrade.warnings,
        controlState: preTrade.state,
      },
      { status: 409 },
    );
  }

  try {
    const brokerOrder = await submitAlpacaOrder(validation.order, "paper");
    await insertBrokerOrderEvent({
      mode: "paper",
      brokerOrderId: brokerOrder?.id ? String(brokerOrder.id) : null,
      clientOrderId: validation.order.clientOrderId,
      symbol: validation.order.symbol,
      eventType: "agent_paper_submitted",
      brokerStatus: brokerOrder?.status ? String(brokerOrder.status) : null,
      payload: brokerOrder,
    }).catch(() => null);
    await recordAuditEvent("agent_trade.paper_submitted", null, {
      symbol: validation.order.symbol,
      confidence: proposal.confidence,
      clientOrderId: validation.order.clientOrderId,
    });
    return NextResponse.json(
      {
        ok: true,
        mode: "paper",
        liveMoney: false,
        proposal,
        brokerOrder,
        advisory: "The agent submitted a paper order only. Live-money autonomy remains blocked.",
      },
      { status: 201 },
    );
  } catch (error) {
    await insertBrokerOrderEvent({
      mode: "paper",
      clientOrderId: validation.order.clientOrderId,
      symbol: validation.order.symbol,
      eventType: "agent_paper_rejected",
      brokerStatus: "rejected",
      payload: { error: error instanceof Error ? error.message : "Agent paper order failed." },
    }).catch(() => null);
    return NextResponse.json(
      { ok: false, mode: "paper", proposal, error: error instanceof Error ? error.message : "Agent paper order failed." },
      { status: 502 },
    );
  }
}
