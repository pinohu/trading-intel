import { calculatePositionSize } from "@/lib/positionSizing";
import type { BuyLead, TradeSignal } from "@/lib/signalEngine";

export type TradeTicket = {
  symbol: string;
  name: string;
  side: "Buy" | "Sell / Avoid";
  status: "Ready to Watch" | "Blocked" | "Protect / Avoid";
  trigger: number;
  entry: number;
  entrySignalNeeded: string;
  stop: number;
  target: number;
  units: number;
  notional: number;
  potentialUnits: number;
  potentialNotional: number;
  maxLoss: number;
  rewardRisk: number;
  riskRewardRatio: number;
  riskPct: number;
  riskBudgetDollars: number;
  dailyLossCapDollars: number;
  unitRisk: number;
  positionSize: string;
  suggestedPositionSize: string;
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
  const entrySignalNeeded =
    lead.status === "Buy Watch"
      ? `Fresh ${lead.symbol} quote remains at or above ${money(lead.trigger)} with no active sell/exit warning.`
      : lead.status === "Buy Lead - Wait for Trigger"
        ? `Wait for ${lead.symbol} to clear ${money(lead.trigger)} on fresh data; no entry before that trigger.`
        : `${lead.symbol} needs a new buy-watch signal before any entry.`;

  return {
    symbol: lead.symbol,
    name: lead.name,
    side: "Buy",
    status: tradeable ? "Ready to Watch" : "Blocked",
    trigger: lead.trigger,
    entry: lead.trigger,
    entrySignalNeeded,
    stop: lead.stop,
    target: lead.target,
    units: sizing.shares,
    notional: sizing.notional,
    potentialUnits: sizing.potentialShares,
    potentialNotional: sizing.potentialNotional,
    maxLoss: sizing.potentialMaxLoss,
    rewardRisk: lead.rewardRisk,
    riskRewardRatio: lead.rewardRisk,
    riskPct: sizing.riskPct,
    riskBudgetDollars: sizing.riskBudgetDollars,
    dailyLossCapDollars: sizing.maxDailyLossDollars,
    unitRisk: sizing.unitRisk,
    positionSize: sizeLabel(sizing.shares, sizing.notional),
    suggestedPositionSize: suggestedSizeLabel({
      shares: sizing.shares,
      notional: sizing.notional,
      maxLoss: sizing.potentialMaxLoss,
      riskBudgetDollars: sizing.riskBudgetDollars,
      limitedBy: sizing.riskBudgetLimitedBy,
    }),
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
      entrySignalNeeded,
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
    trigger: signal.price,
    entry: signal.price,
    entrySignalNeeded: "Do not open a new long. Use this as an exit/protection review only.",
    stop: signal.invalidation,
    target: signal.target,
    units: 0,
    notional: 0,
    potentialUnits: 0,
    potentialNotional: 0,
    maxLoss: 0,
    rewardRisk: signal.rewardRisk,
    riskRewardRatio: signal.rewardRisk,
    riskPct: signal.positionRiskPct,
    riskBudgetDollars: 0,
    dailyLossCapDollars: 0,
    unitRisk: Math.abs(signal.price - signal.invalidation),
    positionSize: "No new long position",
    suggestedPositionSize: "Protect or stand aside; do not size a new long from a sell/avoid signal.",
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

function sizeLabel(units: number, notional: number) {
  if (units <= 0) return "0 units / no position";
  return `${units} units / ${money(notional)} notional`;
}

function suggestedSizeLabel({
  shares,
  notional,
  maxLoss,
  riskBudgetDollars,
  limitedBy,
}: {
  shares: number;
  notional: number;
  maxLoss: number;
  riskBudgetDollars: number;
  limitedBy: "risk-per-trade" | "max-daily-loss";
}) {
  if (shares <= 0) return "No suggested size until the trigger/stop distance supports at least one unit.";
  const cap = limitedBy === "max-daily-loss" ? "daily-loss cap" : "per-trade risk cap";
  return `${shares} units (${money(notional)} notional), risking about ${money(maxLoss)} against a ${money(riskBudgetDollars)} ${cap}.`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
