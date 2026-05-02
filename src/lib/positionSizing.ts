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
  const stopDistance = Math.abs(input.entry - input.stop);
  const shares = stopDistance > 0 ? Math.floor(riskDollars / stopDistance) : 0;
  const notional = shares * input.entry;
  return {
    accountSize,
    riskPct,
    riskDollars: Number(riskDollars.toFixed(2)),
    maxDailyLossPct,
    maxDailyLossDollars: Number(maxDailyLossDollars.toFixed(2)),
    entry: input.entry,
    stop: input.stop,
    stopDistance: Number(stopDistance.toFixed(2)),
    shares,
    notional: Number(notional.toFixed(2)),
    valid: shares > 0 && stopDistance > 0,
  };
}
