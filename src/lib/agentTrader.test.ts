import { describe, expect, it } from "vitest";
import { buildAgentTradeProposals, buildAgentTradingPolicy, orderDraftFromTicket } from "@/lib/agentTrader";
import type { BuyNowSignal } from "@/lib/buyNowEngine";
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
  expectedHold: "Intraday to same-session only",
  maxHold: "Same trading day",
  reviewCadence: "Review every 5-15 minutes",
  exitRule: "Exit on stop, target, stale data, or setup failure",
  tradeable: true,
  reason: "test",
  mustConfirm: ["fresh quote"],
  doNotTradeIf: ["stale quote"],
};

const buyNow: BuyNowSignal = {
  symbol: "NVDA",
  name: "NVIDIA",
  rank: 1,
  action: "Buy Now Candidate",
  price: 100,
  trigger: 100,
  entry: 100,
  entrySignalNeeded: "Fresh NVDA quote remains at or above $100.00.",
  stop: 97,
  target: 106,
  units: 3,
  maxLoss: 9,
  rewardRisk: 2,
  riskRewardRatio: 2,
  potentialUnits: 3,
  potentialNotional: 300,
  positionSize: "3 units / $300.00 notional",
  suggestedPositionSize: "3 units ($300.00 notional), risking about $9.00 against a $100.00 per-trade risk cap.",
  holdingPeriod: "Day trade",
  expectedHold: "Intraday to same-session only",
  maxHold: "Same trading day",
  reviewCadence: "Review every 5-15 minutes",
  confidence: 82,
  dataQuality: "Public Real-Time",
  source: "test",
  updatedAt: new Date().toISOString(),
  reasons: ["trigger active"],
  warnings: [],
  ticket,
  generatedAt: new Date().toISOString(),
};

describe("agent trader", () => {
  it("drafts bracket limit orders from trade tickets", () => {
    const order = orderDraftFromTicket(ticket);
    expect(order.symbol).toBe("NVDA");
    expect(order.type).toBe("limit");
    expect(order.orderClass).toBe("bracket");
    expect(order.takeProfitLimitPrice).toBe(106);
    expect(order.stopLossStopPrice).toBe(97);
  });

  it("requires explicit arming for live-mode proposals", () => {
    const [proposal] = buildAgentTradeProposals({
      buyNow: [buyNow],
      tickets: [ticket],
      mode: "live",
      minConfidence: 75,
      maxProposals: 5,
    });

    expect(proposal.status).toBe("approval-required");
    expect(proposal.blockers.join(" ")).toContain("not armed");
  });

  it("marks live proposals ready when live-agent trading is armed", () => {
    const [proposal] = buildAgentTradeProposals({
      buyNow: [buyNow],
      tickets: [ticket],
      mode: "live",
      minConfidence: 75,
      maxProposals: 5,
      liveAutonomyAllowed: true,
    });

    expect(proposal.status).toBe("live-ready");
    expect(proposal.blockers).toHaveLength(0);
  });

  it("filters below-confidence candidates", () => {
    const proposals = buildAgentTradeProposals({
      buyNow: [{ ...buyNow, confidence: 60 }],
      tickets: [ticket],
      mode: "paper",
      minConfidence: 75,
      maxProposals: 5,
    });

    expect(proposals).toHaveLength(0);
  });

  it("enables supervised paper-agent policy by default", () => {
    const policy = buildAgentTradingPolicy("paper");
    expect(policy.enabled).toBe(true);
    expect(policy.paperAutomationEnabled).toBe(true);
    expect(policy.liveAutonomyAllowed).toBe(false);
    expect(policy.liveAutomationEnabled).toBe(false);
  });
});
