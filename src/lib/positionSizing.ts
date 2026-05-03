export type PositionSizingInput = {
  accountSize: number;
  riskPct: number;
  entry: number;
  stop: number;
  maxDailyLossPct: number;
};

export function calculatePositionSize(input: PositionSizingInput) {
  const accountSize = Math.max(0, input.accountSize);
  const riskPct = Math.max(0, Math.min(input.riskPct, 5));
  const maxDailyLossPct = Math.max(0, Math.min(input.maxDailyLossPct, 10));
  const riskDollars = accountSize * (riskPct / 100);
  const maxDailyLossDollars = accountSize * (maxDailyLossPct / 100);
  const riskBudgetDollars = Math.min(riskDollars, maxDailyLossDollars);
  const stopDistance = Math.abs(input.entry - input.stop);
  const shares = stopDistance > 0 ? Math.floor(riskBudgetDollars / stopDistance) : 0;
  const notional = shares * input.entry;
  const potentialMaxLoss = shares * stopDistance;
  return {
    accountSize,
    riskPct,
    riskDollars: Number(riskDollars.toFixed(2)),
    maxDailyLossPct,
    maxDailyLossDollars: Number(maxDailyLossDollars.toFixed(2)),
    riskBudgetDollars: Number(riskBudgetDollars.toFixed(2)),
    riskBudgetLimitedBy: riskDollars <= maxDailyLossDollars ? "risk-per-trade" as const : "max-daily-loss" as const,
    entry: input.entry,
    stop: input.stop,
    stopDistance: Number(stopDistance.toFixed(2)),
    unitRisk: Number(stopDistance.toFixed(2)),
    shares,
    notional: Number(notional.toFixed(2)),
    potentialShares: shares,
    potentialNotional: Number(notional.toFixed(2)),
    potentialMaxLoss: Number(potentialMaxLoss.toFixed(2)),
    valid: shares > 0 && stopDistance > 0,
  };
}
