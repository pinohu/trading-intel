import { describe, expect, it } from "vitest";
import { evaluateTradingMinds } from "@/lib/tradingMinds";

function input(overrides: Partial<Parameters<typeof evaluateTradingMinds>[0]> = {}): Parameters<typeof evaluateTradingMinds>[0] {
  return {
    symbol: "NVDA",
    market: "Stock/ETF",
    price: 101,
    dayMovePct: 1.2,
    closeLocation: 0.82,
    aboveOpen: true,
    aboveVwapProxy: true,
    liquid: true,
    fresh: true,
    inTradingWindow: true,
    rewardRisk: 1.8,
    quality: "Execution Grade",
    rangeEstimated: false,
    extended: false,
    failedBreakout: false,
    severeWeakness: false,
    volume: 12_000_000,
    ...overrides,
  };
}

describe("tradingMinds", () => {
  it("promotes broad strategy agreement for a fresh liquid breakout setup", () => {
    const consensus = evaluateTradingMinds(input());

    expect(consensus.stance).toBe("buy-watch");
    expect(consensus.score).toBeGreaterThanOrEqual(55);
    expect(consensus.votes.some((vote) => vote.name === "William O'Neil" && vote.stance === "buy-watch")).toBe(true);
    expect(consensus.riskRules.some((rule) => rule.includes("reward/risk"))).toBe(true);
  });

  it("forces stale data into risk-off even when the shape looks strong", () => {
    const consensus = evaluateTradingMinds(input({ fresh: false, quality: "Delayed" }));

    expect(consensus.stance).toBe("risk-off");
    expect(consensus.summary).toContain("stale");
  });
});
