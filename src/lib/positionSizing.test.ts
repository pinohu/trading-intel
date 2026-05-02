import { describe, expect, it } from "vitest";
import { calculatePositionSize } from "@/lib/positionSizing";

describe("calculatePositionSize", () => {
  it("sizes a position from account risk and stop distance", () => {
    const sizing = calculatePositionSize({
      accountSize: 10000,
      riskPct: 1,
      entry: 100,
      stop: 98,
      maxDailyLossPct: 3,
    });

    expect(sizing.riskDollars).toBe(100);
    expect(sizing.stopDistance).toBe(2);
    expect(sizing.shares).toBe(50);
    expect(sizing.notional).toBe(5000);
    expect(sizing.valid).toBe(true);
  });

  it("blocks invalid zero-distance stops", () => {
    const sizing = calculatePositionSize({
      accountSize: 10000,
      riskPct: 1,
      entry: 100,
      stop: 100,
      maxDailyLossPct: 3,
    });

    expect(sizing.shares).toBe(0);
    expect(sizing.valid).toBe(false);
  });
});
