import { brokerConfig, type BrokerMode, type BrokerOrderPayload } from "@/lib/broker";
import type { BuyNowSignal } from "@/lib/buyNowEngine";
import type { TradingControlState } from "@/lib/executionControl";
import { cleanSecret } from "@/lib/security";
import type { TradeTicket } from "@/lib/tradeTicket";

export type AgentTradingPolicy = {
  enabled: boolean;
  paperAutomationEnabled: boolean;
  paperAutomationReady: boolean;
  liveAutomationEnabled: boolean;
  liveAutomationReady: boolean;
  liveAutonomyAllowed: boolean;
  liveRequiresManualApproval: true;
  minConfidence: number;
  maxProposals: number;
  maxPaperOrdersPerRun: number;
  maxLiveOrdersPerRun: number;
  missing: string[];
  restrictions: string[];
};

export type AgentTradeProposal = {
  id: string;
  symbol: string;
  mode: BrokerMode;
  action: "prepare-buy";
  status: "paper-ready" | "live-ready" | "approval-required" | "blocked";
  confidence: number;
  orderDraft: BrokerOrderPayload;
  ticket: TradeTicket;
  reasons: string[];
  blockers: string[];
  createdAt: string;
};

export function buildAgentTradingPolicy(
  mode: BrokerMode = "paper",
  options: {
    controls?: Pick<TradingControlState, "killSwitch" | "allowLiveOrders" | "allowLiveAgentOrders"> | null;
    liveOrderPlacementReady?: boolean;
  } = {},
): AgentTradingPolicy {
  const config = brokerConfig(mode);
  const enabled = cleanSecret(process.env.AGENT_TRADING_ENABLED) !== "false";
  const paperAutomationEnabled = cleanSecret(process.env.AGENT_PAPER_TRADING_ENABLED) !== "false";
  const liveAutomationEnabled = cleanSecret(process.env.AGENT_LIVE_TRADING_ENABLED) === "true";
  const minConfidence = parseEnvNumber("AGENT_MIN_CONFIDENCE", 75, 1, 100);
  const maxProposals = Math.round(parseEnvNumber("AGENT_MAX_PROPOSALS", 5, 1, 20));
  const maxPaperOrdersPerRun = Math.round(parseEnvNumber("AGENT_MAX_PAPER_ORDERS_PER_RUN", 1, 1, 5));
  const maxLiveOrdersPerRun = Math.round(parseEnvNumber("AGENT_MAX_LIVE_ORDERS_PER_RUN", 1, 1, 3));
  const paperConfig = brokerConfig("paper");
  const liveConfig = brokerConfig("live");
  const liveOrderPlacementReady = options.liveOrderPlacementReady ?? (
    liveConfig.executionEnabled &&
    liveConfig.credentialsConfigured &&
    liveConfig.liveTradingEnabled &&
    liveConfig.liveAckConfigured
  );
  const controlsAllowLiveOrders = options.controls?.allowLiveOrders ?? cleanEnvFlag(process.env.CONTROL_ALLOW_LIVE_ORDERS) ?? true;
  const controlsAllowLiveAgentOrders = options.controls?.allowLiveAgentOrders ?? cleanEnvFlag(process.env.CONTROL_ALLOW_LIVE_AGENT_ORDERS) ?? false;
  const killSwitchActive = options.controls?.killSwitch ?? cleanSecret(process.env.TRADING_KILL_SWITCH) === "true";
  const paperAutomationReady = enabled && paperAutomationEnabled && paperConfig.executionEnabled && paperConfig.credentialsConfigured;
  const liveAutomationReady =
    enabled &&
    liveAutomationEnabled &&
    liveOrderPlacementReady &&
    controlsAllowLiveOrders &&
    controlsAllowLiveAgentOrders &&
    !killSwitchActive;

  return {
    enabled,
    paperAutomationEnabled,
    paperAutomationReady,
    liveAutomationEnabled,
    liveAutomationReady,
    liveAutonomyAllowed: liveAutomationReady,
    liveRequiresManualApproval: true,
    minConfidence,
    maxProposals,
    maxPaperOrdersPerRun,
    maxLiveOrdersPerRun,
    missing: [
      !enabled ? "AGENT_TRADING_ENABLED is set to false" : "",
      !paperAutomationEnabled ? "AGENT_PAPER_TRADING_ENABLED is set to false" : "",
      !paperConfig.executionEnabled ? "BROKER_EXECUTION_ENABLED=true" : "",
      !paperConfig.credentialsConfigured ? "Alpaca paper credentials" : "",
      !liveAutomationEnabled ? "AGENT_LIVE_TRADING_ENABLED=true to arm live agent orders" : "",
      !liveOrderPlacementReady ? "Live broker rail ready: live keys, acknowledgement, audit DB, and BROKER_EXECUTION_ENABLED=true" : "",
      !controlsAllowLiveOrders ? "CONTROL_ALLOW_LIVE_ORDERS=true" : "",
      !controlsAllowLiveAgentOrders ? "CONTROL_ALLOW_LIVE_AGENT_ORDERS=true or control-plane allowLiveAgentOrders=true" : "",
      killSwitchActive ? "TRADING_KILL_SWITCH=false" : "",
    ].filter(Boolean),
    restrictions: [
      "Live-money agent orders require a logged-in operator request, matching live acknowledgement, audit storage, and pre-trade controls.",
      "Agents may auto-submit paper orders when Alpaca paper execution is ready.",
      "Cron/bearer automation cannot place live-money agent orders.",
      "Only limit or bracket-limit stock orders are drafted.",
      `Minimum agent confidence is ${minConfidence}.`,
      `At most ${maxPaperOrdersPerRun} paper order(s) per agent run.`,
      `At most ${maxLiveOrdersPerRun} live order(s) per operator-triggered agent run.`,
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
  liveAutonomyAllowed = false,
}: {
  buyNow: BuyNowSignal[];
  tickets: TradeTicket[];
  mode: BrokerMode;
  minConfidence: number;
  maxProposals: number;
  liveAutonomyAllowed?: boolean;
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
        mode === "live" && !liveAutonomyAllowed ? "Live-money agent trading is not armed. Operator acknowledgement and live-agent controls are required." : "",
      ].filter(Boolean);
      const status =
        blockers.length > 0
          ? ticket.tradeable && mode === "live"
            ? "approval-required"
            : "blocked"
          : mode === "live"
            ? "live-ready"
            : "paper-ready";
      return {
        id: `agent-${signal.symbol}-${Math.round(signal.entry * 100)}-${signal.confidence}`,
        symbol: signal.symbol,
        mode,
        action: "prepare-buy",
        status,
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
    ...signal.ticket,
    status: "Ready to Watch",
    tradeable: true,
    reason: signal.reasons.join(" ") || signal.ticket.reason,
    mustConfirm: Array.from(new Set([...signal.ticket.mustConfirm, ...signal.reasons])),
    doNotTradeIf: Array.from(new Set([...signal.ticket.doNotTradeIf, ...signal.warnings])),
  };
}

function parseEnvNumber(key: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanEnvFlag(value: string | undefined) {
  const clean = cleanSecret(value)?.toLowerCase();
  if (clean === "true") return true;
  if (clean === "false") return false;
  return null;
}
