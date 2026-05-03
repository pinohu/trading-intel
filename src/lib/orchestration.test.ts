import { describe, expect, it } from "vitest";
import type { AgentTradeProposal, AgentTradingPolicy } from "@/lib/agentTrader";
import type { ValidatedBrokerOrder } from "@/lib/broker";
import { defaultTradingControlState, type PreTradeControlResult } from "@/lib/executionControl";
import type { FusionPrediction } from "@/lib/fusionAlpha";
import { buildOrchestrationRun, evaluateLiveDecision } from "@/lib/orchestration";
import type { TradeTicket } from "@/lib/tradeTicket";

const ticket: TradeTicket = {
  symbol: "NVDA",
  name: "NVIDIA",
  side: "Buy",
  status: "Ready to Watch",
  trigger: 100,
  entry: 100,
  entrySignalNeeded: "Fresh NVDA quote remains at or above $100.00.",
  stop: 97,
  target: 106,
  units: 3,
  notional: 300,
  potentialUnits: 3,
  potentialNotional: 300,
  maxLoss: 9,
  rewardRisk: 2,
  riskRewardRatio: 2,
  riskPct: 1,
  riskBudgetDollars: 100,
  dailyLossCapDollars: 300,
  unitRisk: 3,
  positionSize: "3 units / $300.00 notional",
  suggestedPositionSize: "3 units ($300.00 notional), risking about $9.00 against a $100.00 per-trade risk cap.",
  holdingPeriod: "Day trade",
  expectedHold: "Intraday",
  maxHold: "Same trading day",
  reviewCadence: "Review every 5-15 minutes",
  exitRule: "Exit on stop, target, stale data, or setup failure.",
  tradeable: true,
  reason: "Aligned test thesis.",
  mustConfirm: ["fresh quote"],
  doNotTradeIf: ["stale quote"],
};

const order: ValidatedBrokerOrder = {
  symbol: "NVDA",
  assetClass: "stock",
  side: "buy",
  qty: 3,
  type: "limit",
  limitPrice: 100,
  timeInForce: "day",
  extendedHours: false,
  orderClass: "bracket",
  takeProfitLimitPrice: 106,
  stopLossStopPrice: 97,
  clientOrderId: "agent-nvda-test",
  source: "trade-ticket",
};

const policy: AgentTradingPolicy = {
  enabled: true,
  paperAutomationEnabled: true,
  paperAutomationReady: true,
  liveAutonomyAllowed: false,
  liveRequiresManualApproval: true,
  minConfidence: 75,
  maxProposals: 5,
  maxPaperOrdersPerRun: 1,
  missing: [],
  restrictions: ["Agents cannot autonomously place live-money orders."],
};

const preTrade: PreTradeControlResult = {
  ok: true,
  state: defaultTradingControlState,
  blockers: [],
  warnings: [],
  openOrdersChecked: 0,
  dailySubmittedNotional: 0,
};

const proposal: AgentTradeProposal = {
  id: "agent-nvda",
  symbol: "NVDA",
  mode: "paper",
  action: "prepare-buy",
  status: "paper-ready",
  confidence: 82,
  orderDraft: {
    symbol: "NVDA",
    assetClass: "stock",
    side: "buy",
    qty: 3,
    type: "limit",
    limitPrice: 100,
    timeInForce: "day",
    orderClass: "bracket",
    takeProfitLimitPrice: 106,
    stopLossStopPrice: 97,
    clientOrderId: "agent-nvda-test",
    source: "trade-ticket",
  },
  ticket,
  reasons: ["trigger active"],
  blockers: [],
  createdAt: "2026-05-02T00:00:00.000Z",
};

function prediction(overrides: Partial<FusionPrediction> = {}): FusionPrediction {
  return {
    symbol: "NVDA",
    name: "NVIDIA",
    action: "Strong Buy / Paper Candidate",
    score: 82,
    confidence: 78,
    priority: 64,
    direction: "buy",
    horizon: "Day trade",
    expectedHold: "Intraday",
    maxHold: "Same trading day",
    reviewCadence: "Review every 5-15 minutes",
    entry: 100,
    stop: 97,
    target: 106,
    rewardRisk: 2,
    forecast: {
      units: 3,
      notional: 300,
      expectedMovePct: 6,
      projectedPnl: 18,
      maxLoss: 9,
      label: "Projected gross paper P/L at target",
    },
    thesis: "NVDA has aligned test evidence across research, strategy, and risk.",
    operatorAction: "Paper candidate.",
    conflicts: [],
    blockers: [],
    engineFindings: [],
    algorithmFindings: [],
    topSupports: [],
    topChallenges: [],
    ...overrides,
  };
}

describe("orchestration", () => {
  it("blocks live execution when the risk reviewer has not approved", () => {
    const gate = evaluateLiveDecision({ riskApproved: false });

    expect(gate.status).toBe("blocked");
    expect(gate.manualApprovalRequired).toBe(true);
    expect(gate.reason).toContain("risk reviewer has not approved");
  });

  it("keeps live execution manual even after risk approval", () => {
    const gate = evaluateLiveDecision({ riskApproved: true });

    expect(gate.status).toBe("approval-required");
    expect(gate.riskApproved).toBe(true);
    expect(gate.reason).toContain("manual broker rail");
  });

  it("creates a ready-for-paper run while leaving live gated", () => {
    const run = buildOrchestrationRun({
      mode: "paper",
      provider: "test",
      symbols: ["NVDA"],
      predictions: [prediction()],
      proposals: [proposal],
      policy,
      paperPreTrade: preTrade,
      validatedPaperOrder: order,
      backtestResults: [{ symbol: "NVDA", status: "ok", trades: 8, totalReturnPct: 9.5, maxDrawdownPct: 4.2, profitFactor: 1.8 }],
      now: new Date("2026-05-02T00:00:00.000Z"),
    });

    expect(run.status).toBe("ready-for-paper");
    expect(run.decision.paper.status).toBe("ready");
    expect(run.decision.live.status).toBe("approval-required");
    expect(run.governance.noLiveWithoutRiskApproval).toBe(true);
    expect(run.governance.referenceReportsApplied).toContain("Broker Execution");
  });

  it("blocks paper and live execution when the prediction carries risk blockers", () => {
    const run = buildOrchestrationRun({
      mode: "paper",
      provider: "test",
      symbols: ["NVDA"],
      predictions: [prediction({ blockers: ["Quote is stale or unavailable."] })],
      proposals: [proposal],
      policy,
      paperPreTrade: preTrade,
      validatedPaperOrder: order,
      now: new Date("2026-05-02T00:00:00.000Z"),
    });

    expect(run.status).toBe("blocked");
    expect(run.decision.paper.status).toBe("blocked");
    expect(run.decision.live.status).toBe("blocked");
  });
});
