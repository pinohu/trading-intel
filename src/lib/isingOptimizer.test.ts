import { describe, expect, it } from "vitest";
import { optimizeIsingBasket, type IsingCandidate } from "@/lib/isingOptimizer";

const base: Omit<IsingCandidate, "symbol" | "name" | "group" | "score" | "notional" | "riskDollars"> = {
  confidence: 80,
  rewardRisk: 2,
  units: 10,
  entry: 100,
  stop: 98,
  target: 104,
  tradeable: true,
  reasons: ["test"],
  blockers: [],
};

function candidate(partial: Pick<IsingCandidate, "symbol" | "name" | "group" | "score" | "notional" | "riskDollars">): IsingCandidate {
  return { ...base, ...partial };
}

describe("ising optimizer", () => {
  it("selects the best basket inside budget, risk, and position limits", () => {
    const result = optimizeIsingBasket({
      budget: 600,
      maxRiskDollars: 80,
      maxPositions: 2,
      seed: "stable",
      candidates: [
        candidate({ symbol: "NVDA", name: "NVIDIA", group: "semiconductors", score: 92, notional: 300, riskDollars: 30 }),
        candidate({ symbol: "SPY", name: "SPDR S&P 500", group: "index", score: 85, notional: 250, riskDollars: 25 }),
        candidate({ symbol: "TSLA", name: "Tesla", group: "high-beta growth", score: 40, notional: 500, riskDollars: 70 }),
      ],
    });

    expect(result.selected.map((item) => item.symbol)).toEqual(["NVDA", "SPY"]);
    expect(result.budgetUsed).toBeLessThanOrEqual(600);
    expect(result.riskUsed).toBeLessThanOrEqual(80);
  });

  it("penalizes overlapping risk groups", () => {
    const result = optimizeIsingBasket({
      budget: 900,
      maxRiskDollars: 200,
      maxPositions: 2,
      seed: "overlap",
      overlapPenalty: 5,
      candidates: [
        candidate({ symbol: "NVDA", name: "NVIDIA", group: "semiconductors", score: 90, notional: 300, riskDollars: 30 }),
        candidate({ symbol: "AMD", name: "Advanced Micro Devices", group: "semiconductors", score: 88, notional: 300, riskDollars: 30 }),
        candidate({ symbol: "SPY", name: "SPDR S&P 500", group: "index", score: 72, notional: 300, riskDollars: 30 }),
      ],
    });

    expect(result.selected.some((item) => item.symbol === "SPY")).toBe(true);
    expect(result.diagnostics.selectedGroups.length).toBe(result.selected.length);
  });

  it("rejects untradeable candidates even when they score well", () => {
    const result = optimizeIsingBasket({
      budget: 1000,
      maxRiskDollars: 100,
      maxPositions: 1,
      seed: "blocked",
      candidates: [
        { ...candidate({ symbol: "BAD", name: "Blocked", group: "single-name", score: 99, notional: 100, riskDollars: 10 }), tradeable: false, blockers: ["Blocked"] },
        candidate({ symbol: "SPY", name: "SPDR S&P 500", group: "index", score: 70, notional: 100, riskDollars: 10 }),
      ],
    });

    expect(result.selected.map((item) => item.symbol)).toEqual(["SPY"]);
  });
});
