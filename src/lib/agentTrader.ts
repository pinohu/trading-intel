import { brokerConfig, type BrokerMode, type BrokerOrderPayload } from "@/lib/broker";
import type { BuyNowSignal } from "@/lib/buyNowEngine";
import { cleanSecret } from "@/lib/security";
import type { TradeTicket } from "@/lib/tradeTicket";

export type AgentTradingPolicy = {
  enabled: boolean;
  paperAutomationEnabled: boolean;
  paperAutomationReady: boolean;
  liveAutonomyAllowed: false;
  liveRequiresManualApproval: true;
  minConfidence: number;
  maxProposals: number;
  maxPaperOrdersPerRun: number;
  missing: string[];
  restrictions: string[];
};

export type AgentTradeProposal = {
  id: string;
  symbol: string;
  mode: BrokerMode;
  action: "prepare-buy";
  status: "paper-ready" | "approval-required" | "blocked";
  confidence: number;
  orderDraft: BrokerOrderPayload;
  ticket: TradeTicket;
  reasons: string[];
  blockers: string[];
  createdAt: string;
};

export function buildAgentTradingPolicy(mode: BrokerMode = "paper"): AgentTradingPolicy {
  const config = brokerConfig(mode);
  const enabled = cleanSecret(process.env.AGENT_TRADING_ENABLED) !== "false";
  const paperAutomationEnabled = cleanSecret(process.env.AGENT_PAPER_TRADING_ENABLED) !== "false";
  const minConfidence = parseEnvNumber("AGENT_MIN_CONFIDENCE", 75, 1, 100);
  const maxProposals = Math.round(parseEnvNumber("AGENT_MAX_PROPOSALS", 5, 1, 20));
  const maxPaperOrdersPerRun = Math.round(parseEnvNumber("AGENT_MAX_PAPER_ORDERS_PER_RUN", 1, 1, 5));
  const paperConfig = brokerConfig("paper");
  const paperAutomationReady = enabled && paperAutomationEnabled && paperConfig.executionEnabled && paperConfig.credentialsConfigured;

  return {
    enabled,
    paperAutomationEnabled,
    paperAutomationReady,
    liveAutonomyAllowed: false,
    liveRequiresManualApproval: true,
    minConfidence,
    maxProposals,
    maxPaperOrdersPerRun,
    missing: [
      !enabled ? "AGENT_TRADING_ENABLED is set to false" : "",
      !paperAutomationEnabled ? "AGENT_PAPER_TRADING_ENABLED is set to false" : "",
      !paperConfig.executionEnabled ? "BROKER_EXECUTION_ENABLED=true" : "",
      !paperConfig.credentialsConfigured ? "Alpaca paper credentials" : "",
    ].filter(Boolean),
    restrictions: [
      "Agents cannot autonomously place live-money orders.",
      "Agents may auto-submit paper orders when Alpaca paper execution is ready.",
      "Live orders require a logged-in human, the live acknowledgement phrase, and the existing broker order route.",
      "Only limit or bracket-limit stock orders are drafted.",
      `Minimum agent confidence is ${minConfidence}.`,
      `At most ${maxPaperOrdersPerRun} paper order(s) per agent run.`,
      `Current broker mode checked for this policy: ${config.mode}.`,
    ],
  };
}

export function buildAgentTradeProposals({
  buyNow,
  tickets,
  mode,
  minConfidence,
  maxProposals,
}: {
  buyNow: BuyNowSignal[];
  tickets: TradeTicket[];
  mode: BrokerMode;
  minConfidence: number;
  maxProposals: number;
}): AgentTradeProposal[] {
  const ticketBySymbol = new Map(tickets.map((ticket) => [ticket.symbol, ticket]));
  const createdAt = new Date().toISOString();
  return buyNow
    .filter((signal) => signal.confidence >= minConfidence)
    .slice(0, maxProposals)
    .map((signal) => {
      const ticket = ticketBySymbol.get(signal.symbol) ?? ticketFromBuyNow(signal);
      const orderDraft = orderDraftFromTicket(ticket);
      const blockers = [
        !ticket.tradeable ? "Trade ticket is not marked tradeable." : "",
        mode === "live" ? "Live-money agent autonomy is blocked. Human approval is required." : "",
      ].filter(Boolean);
      return {
        id: `agent-${signal.symbol}-${Math.round(signal.entry * 100)}-${signal.confidence}`,
        symbol: signal.symbol,
        mode,
        action: "prepare-buy",
        status: blockers.length ? (mode === "live" ? "approval-required" : "blocked") : "paper-ready",
        confidence: signal.confidence,
        orderDraft,
        ticket,
        reasons: signal.reasons,
        blockers,
        createdAt,
      };
    });
}

export function orderDraftFromTicket(ticket: TradeTicket): BrokerOrderPayload {
  return {
    symbol: ticket.symbol,
    assetClass: "stock",
    side: "buy",
    qty: ticket.units,
    type: "limit",
    limitPrice: ticket.entry,
    timeInForce: "day",
    extendedHours: false,
    orderClass: "bracket",
    takeProfitLimitPrice: ticket.target,
    stopLossStopPrice: ticket.stop,
    clientOrderId: `agent-${ticket.symbol}-${Date.now()}`.slice(0, 48),
    source: "trade-ticket",
  };
}

function ticketFromBuyNow(signal: BuyNowSignal): TradeTicket {
  return {
    symbol: signal.symbol,
    name: signal.name,
    side: "Buy",
    status: "Ready to Watch",
    entry: signal.entry,
    stop: signal.stop,
    target: signal.target,
    units: signal.units,
    notional: Number((signal.units * signal.entry).toFixed(2)),
    maxLoss: signal.maxLoss,
    rewardRisk: signal.rewardRisk,
    riskPct: signal.ticket.riskPct,
    holdingPeriod: signal.holdingPeriod,
    expectedHold: signal.expectedHold,
    maxHold: signal.maxHold,
    reviewCadence: signal.reviewCadence,
    exitRule: signal.ticket.exitRule,
    tradeable: true,
    reason: signal.reasons.join(" "),
    mustConfirm: signal.reasons,
    doNotTradeIf: signal.warnings,
  };
}

function parseEnvNumber(key: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
