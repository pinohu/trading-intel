import { describe, expect, it } from "vitest";
import { buildComplianceReadiness } from "@/lib/compliance";
import { buildSectorRelativeRanks } from "@/lib/sectorIntelligence";
import { buildWorkerReadiness } from "@/lib/workerReadiness";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";

function score(symbol: string, ensembleScore: number): AlgorithmCouncilScore {
  return {
    symbol,
    name: symbol,
    sector: "Technology",
    recommendation: "Buy Watch",
    ensembleScore,
    confidence: ensembleScore,
    dataCoveragePct: 90,
    modelVersion: "test",
    factorScores: [],
    thesis: "test",
    bearCase: "test",
    plainAction: "test",
    riskControls: [],
    sources: [],
    generatedAt: new Date().toISOString(),
  };
}

describe("institutional readiness helpers", () => {
  it("ranks symbols relative to sector peers", () => {
    const ranks = buildSectorRelativeRanks([score("NVDA", 90), score("MSFT", 70), score("AAPL", 50)]);

    expect(ranks.find((item) => item.symbol === "NVDA")?.sectorRank).toBe(1);
    expect(ranks.find((item) => item.symbol === "NVDA")?.sectorPercentile).toBe(100);
    expect(ranks.find((item) => item.symbol === "AAPL")?.sectorPercentile).toBe(0);
  });

  it("reports worker readiness without requiring workers to be enabled", () => {
    const readiness = buildWorkerReadiness();

    expect(readiness.ok).toBe(true);
    expect(readiness.recommendedWorkers.map((worker) => worker.name)).toContain("market-scan-worker");
  });

  it("keeps compliance boundary explicit", () => {
    const readiness = buildComplianceReadiness();

    expect(readiness.ok).toBe(true);
    expect(readiness.controls.some((control) => control.key === "research-boundary")).toBe(true);
  });
});
