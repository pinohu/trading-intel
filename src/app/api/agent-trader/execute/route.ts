import { NextResponse } from "next/server";
import { buildAgentTradeProposals, buildAgentTradingPolicy } from "@/lib/agentTrader";
import { recordAuditEvent } from "@/lib/audit";
import {
  brokerConfig,
  brokerReadiness,
  createBrokerOrderAudit,
  insertBrokerOrderEvent,
  submitAlpacaOrder,
  updateBrokerOrderAudit,
  validateBrokerOrderPayload,
} from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { evaluatePreTradeControls, getTradingControlState } from "@/lib/executionControl";
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
  const mode = modeFromRequest(request);
  const userSession = hasValidUserSession(request);
  if (mode === "live" ? !userSession : !authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: mode === "live"
          ? "A logged-in operator session is required for live-money agent execution."
          : "Unauthorized agent-trader request.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    symbol?: string;
    symbols?: string;
    provider?: string;
    accountSize?: number;
    riskPct?: number;
    maxDailyLossPct?: number;
    liveAcknowledgement?: string;
    acknowledgement?: string;
    confirmLiveAgentTrading?: boolean;
  };
  const [controls, liveReadiness] = await Promise.all([
    getTradingControlState(),
    brokerReadiness("live"),
  ]);
  const policy = buildAgentTradingPolicy(mode, {
    controls,
    liveOrderPlacementReady: liveReadiness.orderPlacementReady,
  });
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
    liveAutonomyAllowed: policy.liveAutonomyAllowed,
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
    if (!policy.liveAutonomyAllowed) {
      await recordAuditEvent("agent_trade.live_blocked", null, {
        symbol: proposal.symbol,
        confidence: proposal.confidence,
        missing: policy.missing.join("; "),
      });
      return NextResponse.json(
        {
          ok: false,
          mode,
          proposal,
          policy,
          readiness: liveReadiness,
          error: "Live-money agent execution is not armed. Enable live-agent trading, live broker readiness, acknowledgement, and control-plane permission first.",
          manualApprovalRequired: true,
        },
        { status: 409 },
      );
    }

    if (proposal.status !== "live-ready") {
      await recordAuditEvent("agent_trade.live_proposal_blocked", null, {
        symbol: proposal.symbol,
        confidence: proposal.confidence,
        status: proposal.status,
        blockers: proposal.blockers.join("; "),
      });
      return NextResponse.json(
        {
          ok: false,
          mode,
          proposal,
          policy,
          error: "The selected proposal is not live-ready.",
          blockers: proposal.blockers,
          manualApprovalRequired: true,
        },
        { status: 409 },
      );
    }

    if (body.confirmLiveAgentTrading !== true) {
      await recordAuditEvent("agent_trade.live_confirmation_missing", null, {
        symbol: proposal.symbol,
        confidence: proposal.confidence,
      });
      return NextResponse.json(
        {
          ok: false,
          mode,
          proposal,
          policy,
          error: "Set confirmLiveAgentTrading=true and include the live acknowledgement phrase to submit a real-money agent order.",
          manualApprovalRequired: true,
        },
        { status: 400 },
      );
    }

    if (!liveReadiness.orderPlacementReady) {
      return NextResponse.json({ ok: false, mode, proposal, policy, readiness: liveReadiness, error: "Live broker execution is not ready." }, { status: 503 });
    }

    const liveDraft = {
      ...proposal.orderDraft,
      acknowledgement: body.liveAcknowledgement ?? body.acknowledgement,
      clientOrderId: `agent-live-${proposal.symbol}-${crypto.randomUUID().slice(0, 18)}`.slice(0, 48),
    };
    const validation = validateBrokerOrderPayload(liveDraft, brokerConfig("live"));
    if (!validation.ok) {
      await recordAuditEvent("agent_trade.live_validation_failed", null, {
        symbol: proposal.symbol,
        confidence: proposal.confidence,
        error: validation.error,
      });
      return NextResponse.json({ ok: false, mode, proposal, policy, error: validation.error }, { status: 400 });
    }

    const preTrade = await evaluatePreTradeControls({ mode: "live", order: validation.order });
    if (!preTrade.ok) {
      await recordAuditEvent("agent_trade.live_pretrade_blocked", null, {
        symbol: validation.order.symbol,
        confidence: proposal.confidence,
        blockers: preTrade.blockers.join("; "),
      });
      return NextResponse.json(
        {
          ok: false,
          mode,
          proposal,
          policy,
          error: "Pre-trade controls blocked this live-money agent order.",
          blockers: preTrade.blockers,
          warnings: preTrade.warnings,
          controlState: preTrade.state,
        },
        { status: 409 },
      );
    }

    const auditId = await createBrokerOrderAudit(validation.order, "live").catch(() => null);
    if (!auditId) {
      return NextResponse.json({ ok: false, mode, proposal, policy, error: "Live order audit storage is unavailable." }, { status: 503 });
    }

    try {
      await recordAuditEvent("agent_trade.live_requested", null, {
        symbol: validation.order.symbol,
        confidence: proposal.confidence,
        clientOrderId: validation.order.clientOrderId,
      });
      const brokerOrder = await submitAlpacaOrder(validation.order, "live");
      await updateBrokerOrderAudit(auditId, "submitted", brokerOrder);
      await insertBrokerOrderEvent({
        auditId,
        mode: "live",
        brokerOrderId: brokerOrder?.id ? String(brokerOrder.id) : null,
        clientOrderId: validation.order.clientOrderId,
        symbol: validation.order.symbol,
        eventType: "agent_live_submitted",
        brokerStatus: brokerOrder?.status ? String(brokerOrder.status) : null,
        payload: brokerOrder,
      }).catch(() => null);
      await recordAuditEvent("agent_trade.live_submitted", null, {
        symbol: validation.order.symbol,
        confidence: proposal.confidence,
        clientOrderId: validation.order.clientOrderId,
        auditId,
      });
      return NextResponse.json(
        {
          ok: true,
          mode: "live",
          liveMoney: true,
          proposal,
          brokerOrder,
          auditId,
          advisory: "The agent submitted a real-money live bracket-limit order after operator acknowledgement, broker readiness, audit storage, and pre-trade controls passed.",
        },
        { status: 201 },
      );
    } catch (error) {
      await updateBrokerOrderAudit(auditId, "rejected", { error: error instanceof Error ? error.message : "Agent live order failed." }).catch(() => null);
      await insertBrokerOrderEvent({
        auditId,
        mode: "live",
        clientOrderId: validation.order.clientOrderId,
        symbol: validation.order.symbol,
        eventType: "agent_live_rejected",
        brokerStatus: "rejected",
        payload: { error: error instanceof Error ? error.message : "Agent live order failed." },
      }).catch(() => null);
      await recordAuditEvent("agent_trade.live_rejected", null, {
        symbol: proposal.symbol,
        confidence: proposal.confidence,
        error: error instanceof Error ? error.message : "Agent live order failed.",
      });
      return NextResponse.json(
        { ok: false, mode: "live", proposal, error: error instanceof Error ? error.message : "Agent live order failed." },
        { status: 502 },
      );
    }
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

  if (proposal.status !== "paper-ready") {
    return NextResponse.json(
      {
        ok: false,
        mode,
        proposal,
        policy,
        error: "The selected proposal is not paper-ready.",
        blockers: proposal.blockers,
      },
      { status: 409 },
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
        advisory: "The agent submitted a paper bracket-limit order only. Live-money agent execution requires separate live-agent arming and per-order operator acknowledgement.",
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
