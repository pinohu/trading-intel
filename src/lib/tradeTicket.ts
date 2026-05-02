import { calculatePositionSize } from "@/lib/positionSizing";
import type { BuyLead, TradeSignal } from "@/lib/signalEngine";

export type TradeTicket = {
  symbol: string;
  name: string;
  side: "Buy" | "Sell / Avoid";
  status: "Ready to Watch" | "Blocked" | "Protect / Avoid";
  entry: number;
  stop: number;
  target: number;
  units: number;
  notional: number;
  maxLoss: number;
  rewardRisk: number;
  riskPct: number;
  holdingPeriod: string;
  expectedHold: string;
  maxHold: string;
  reviewCadence: string;
  exitRule: string;
  tradeable: boolean;
  reason: string;
  mustConfirm: string[];
  doNotTradeIf: string[];
};

export function buildBuyTradeTicket({
  lead,
  accountSize,
  riskPct,
  maxDailyLossPct,
}: {
  lead: BuyLead;
  accountSize: number;
  riskPct: number;
  maxDailyLossPct: number;
}): TradeTicket {
  const sizing = calculatePositionSize({
    accountSize,
    riskPct,
    entry: lead.trigger,
    stop: lead.stop,
    maxDailyLossPct,
  });
  const tradeable = lead.status !== "No Buy" && lead.dataFresh && sizing.valid;

  return {
    symbol: lead.symbol,
    name: lead.name,
    side: "Buy",
    status: tradeable ? "Ready to Watch" : "Blocked",
    entry: lead.trigger,
    stop: lead.stop,
    target: lead.target,
    units: sizing.shares,
    notional: sizing.notional,
    maxLoss: sizing.riskDollars,
    rewardRisk: lead.rewardRisk,
    riskPct: sizing.riskPct,
    holdingPeriod: lead.holdingPeriod.label,
    expectedHold: lead.holdingPeriod.expectedHold,
    maxHold: lead.holdingPeriod.maxHold,
    reviewCadence: lead.holdingPeriod.reviewCadence,
    exitRule: lead.holdingPeriod.exitRule,
    tradeable,
    reason: lead.reason,
    mustConfirm: [
      `Holding period: ${lead.holdingPeriod.expectedHold}.`,
      `Price reaches or clears ${money(lead.trigger)} with fresh data.`,
      "No major breaking news contradicts the trade.",
      "Spread and liquidity are acceptable before entry.",
      "Position size keeps max loss inside the configured risk limit.",
    ],
    doNotTradeIf: [
      "The quote is stale or the feed quality drops.",
      `Price falls below ${money(lead.stop)} before entry.`,
      "A scheduled event is about to release and volatility is likely to spike.",
      "The trade is not written in the journal before acting.",
      ...lead.warnings.slice(0, 2),
    ],
  };
}

export function buildSellProtectionTicket(signal: TradeSignal | undefined): TradeTicket | null {
  if (!signal) return null;
  return {
    symbol: signal.symbol,
    name: signal.name,
    side: "Sell / Avoid",
    status: "Protect / Avoid",
    entry: signal.price,
    stop: signal.invalidation,
    target: signal.target,
    units: 0,
    notional: 0,
    maxLoss: 0,
    rewardRisk: signal.rewardRisk,
    riskPct: signal.positionRiskPct,
    holdingPeriod: signal.holdingPeriod.label,
    expectedHold: signal.holdingPeriod.expectedHold,
    maxHold: signal.holdingPeriod.maxHold,
    reviewCadence: signal.holdingPeriod.reviewCadence,
    exitRule: signal.holdingPeriod.exitRule,
    tradeable: false,
    reason: signal.reason,
    mustConfirm: [
      "If already holding, review whether the position still has a valid thesis.",
      "Check news and market context before deciding whether to exit or hedge.",
      "Do not open a new long while sell/exit rules are active.",
    ],
    doNotTradeIf: [
      "You are trying to recover a loss emotionally.",
      "The quote is stale.",
      "You cannot define the new invalidation level.",
    ],
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
