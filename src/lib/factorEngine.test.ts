import { describe, expect, it } from "vitest";
import { rankAlgorithmCouncilScores, scoreAlgorithmCouncil } from "@/lib/factorEngine";
import type { FundamentalSnapshot } from "@/lib/fundamentals";
import type { SignalQuote } from "@/lib/signalEngine";

const quote: SignalQuote = {
  symbol: "NVDA",
  name: "NVIDIA",
  price: 105,
  change: 3,
  changePct: 2.9,
  open: 102,
  high: 106,
  low: 101,
  volume: 18_000_000,
  source: "Alpaca test feed",
  quality: "Execution Grade",
  updatedAt: new Date().toISOString(),
  marketStatus: "REGULAR",
};

const strongFundamentals: FundamentalSnapshot = {
  symbol: "NVDA",
  cik: "0001045810",
  name: "NVIDIA",
  source: "SEC CompanyFacts",
  updatedAt: new Date().toISOString(),
  dataQuality: "official-sec",
  missing: [],
  provenance: {
    basis: "annual-10-k",
    latestFiscalYear: 2025,
    previousFiscalYear: 2024,
    latestFiledAt: "2026-02-20",
    previousFiledAt: "2025-02-21",
    sourceLimitations: [],
    pointInTimeNote: "Test provenance.",
  },
  metrics: {
    revenue: 100_000_000_000,
    revenueGrowth: 0.3,
    grossMargin: 0.58,
    operatingMargin: 0.27,
    netMargin: 0.18,
    roa: 0.14,
    assetTurnover: 1.2,
    debtToAssets: 0.2,
    currentRatio: 1.8,
    fcfMargin: 0.18,
    earningsYield: 0.08,
    salesYield: 1,
    bookToMarket: 0.45,
    assetGrowth: 0.03,
    accrualsToAssets: 0.01,
    piotroskiFScore: 8,
    beneishMScore: -2.7,
    beneishRisk: "low",
  },
};

describe("factorEngine", () => {
  it("promotes high-quality, liquid, official-data names into strong buy watch research", () => {
    const score = scoreAlgorithmCouncil({ quote, fundamentals: strongFundamentals });

    expect(score.recommendation).toBe("Strong Buy Watch");
    expect(score.ensembleScore).toBeGreaterThanOrEqual(78);
    expect(score.dataCoveragePct).toBe(100);
    expect(score.riskControls).toContain("Backtest this factor mix before using real money.");
  });

  it("blocks promotion when accounting risk is high even if other factors look good", () => {
    const score = scoreAlgorithmCouncil({
      quote,
      fundamentals: {
        ...strongFundamentals,
        metrics: { ...strongFundamentals.metrics, beneishMScore: -1.1, beneishRisk: "high" },
      },
    });

    expect(score.recommendation).toBe("Avoid / Sell Watch");
    expect(score.plainAction).toContain("Do not chase");
  });

  it("ranks stronger recommendations ahead of weaker scores", () => {
    const strong = scoreAlgorithmCouncil({ quote, fundamentals: strongFundamentals });
    const weak = scoreAlgorithmCouncil({
      quote: { ...quote, symbol: "WEAK", changePct: -6, price: 96, open: 102, low: 95, high: 103 },
      fundamentals: {
        ...strongFundamentals,
        symbol: "WEAK",
        metrics: {
          ...strongFundamentals.metrics,
          grossMargin: 0.12,
          netMargin: -0.08,
          roa: -0.04,
          debtToAssets: 0.9,
          fcfMargin: -0.08,
          piotroskiFScore: 2,
          beneishMScore: -1.2,
          beneishRisk: "high",
        },
      },
    });

    expect(rankAlgorithmCouncilScores([weak, strong])[0].symbol).toBe("NVDA");
  });
});
