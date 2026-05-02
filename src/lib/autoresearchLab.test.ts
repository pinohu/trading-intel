import { describe, expect, it } from "vitest";
import { autoResearchCandidates, scoreAutoResearchExperiment } from "@/lib/autoresearchLab";

describe("autoresearch lab", () => {
  it("keeps a bounded candidate set for safe serverless runs", () => {
    expect(autoResearchCandidates.length).toBeGreaterThanOrEqual(3);
    expect(autoResearchCandidates.length).toBeLessThanOrEqual(5);
  });

  it("rewards stronger evidence and penalizes fragile runs", () => {
    const strong = scoreAutoResearchExperiment({
      symbolsTested: 4,
      trades: 24,
      winRate: 58,
      avgReturnPct: 0.5,
      totalReturnPct: 11,
      maxDrawdownPct: 4,
      profitFactor: 1.8,
    });
    const weak = scoreAutoResearchExperiment({
      symbolsTested: 4,
      trades: 2,
      winRate: 40,
      avgReturnPct: -0.2,
      totalReturnPct: -3,
      maxDrawdownPct: 14,
      profitFactor: 0.7,
    });

    expect(strong).toBeGreaterThan(weak);
  });
});
