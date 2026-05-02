import { describe, expect, it } from "vitest";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { engineCapabilities } from "@/lib/engineCatalog";
import { buildFusionAlphaPredictions } from "@/lib/fusionAlpha";
import { generateBuyLeads, generateSignals, type SignalQuote } from "@/lib/signalEngine";
import type { BacktestSymbolResult } from "@/lib/backtesting";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";
import type { TradingAgentsDecision } from "@/lib/tradingAgents";

const quote: SignalQuote = {
  symbol: "NVDA",
  name: "NVIDIA",
  price: 101,
  change: 1,
  changePct: 1,
  open: 100,
  high: 102,
  low: 99,
  volume: 10_000_000,
  source: "Test feed",
  quality: "Execution Grade",
  updatedAt: new Date().toISOString(),
  marketStatus: "REGULAR",
};

const councilScore: AlgorithmCouncilScore = {
  symbol: "NVDA",
  name: "NVIDIA",
  sector: "Technology",
  recommendation: "Strong Buy Watch",
  ensembleScore: 84,
  confidence: 82,
  dataCoveragePct: 88,
  modelVersion: "test",
  factorScores: [
    { name: "Value", score: 70, weight: 0.18, rationale: [] },
    { name: "Quality", score: 88, weight: 0.2, rationale: [] },
    { name: "Profitability", score: 90, weight: 0.15, rationale: [] },
    { name: "Investment Discipline", score: 80, weight: 0.12, rationale: [] },
    { name: "Momentum / Tape", score: 86, weight: 0.16, rationale: [] },
    { name: "Accounting Risk", score: 82, weight: 0.12, rationale: [] },
    { name: "Data Quality / Risk Gate", score: 92, weight: 0.07, rationale: [] },
  ],
  thesis: "Strong test thesis.",
  bearCase: "Valuation risk.",
  plainAction: "Watch for entry.",
  riskControls: ["Use a stop."],
  sources: ["test"],
  generatedAt: new Date().toISOString(),
};

const backtest: BacktestSymbolResult = {
  symbol: "NVDA",
  bars: 180,
  trades: 8,
  winRate: 62.5,
  avgReturnPct: 1.1,
  totalReturnPct: 9.5,
  maxDrawdownPct: 4.2,
  profitFactor: 1.8,
  status: "ok",
  validation: {
    status: "ok",
    method: "70/30 chronological holdout",
    outOfSample: { trades: 3, totalReturnPct: 3.2, maxDrawdownPct: 2.1 },
    robustness: 2.8,
  },
};

const agentDecision: TradingAgentsDecision = {
  symbol: "NVDA",
  rating: "Research Buy Watch",
  action: "Prepare a paper candidate only after trigger confirmation",
  holdingPeriod: "Day trade",
  expectedHold: "Intraday with 1-5 trading-day paper validation window",
  maxHold: "5 trading days",
  reviewCadence: "Review every 5-15 minutes",
  exitRule: "Exit if stop, target, or data deterioration occurs",
  evidenceGrade: "Strong multi-source evidence",
  evidenceSummary: ["Quote, factor, signal, and backtest alignment."],
  summary: "Aligned.",
  thesis: "Aligned.",
  risks: ["Execution risk."],
  portfolioDecision: "Paper watch.",
};

describe("fusionAlpha", () => {
  it("turns all mapped repos and algorithm families into one scored prediction", () => {
    const signals = generateSignals([quote], 1);
    const buyLeads = generateBuyLeads([quote], 1);
    const buyNow = generateBuyNowSignals({ quotes: [quote], accountSize: 10000, riskPct: 1, maxDailyLossPct: 3 });
    const predictions = buildFusionAlphaPredictions({
      quotes: [quote],
      signals,
      buyLeads,
      buyNow: buyNow.buyNow,
      blockedBuyNow: buyNow.blocked,
      algorithmScores: [councilScore],
      backtestResults: [backtest],
      tradingAgents: [agentDecision],
      brokerReady: true,
    });

    expect(predictions[0].symbol).toBe("NVDA");
    expect(predictions[0].engineFindings).toHaveLength(engineCapabilities.length);
    expect(predictions[0].algorithmFindings).toHaveLength(6);
    expect(predictions[0].score).toBeGreaterThan(65);
    expect(predictions[0].operatorAction).toContain("Paper candidate");
  });

  it("blocks stale data even when other evidence is constructive", () => {
    const stale = { ...quote, updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
    const signals = generateSignals([stale], 1);
    const predictions = buildFusionAlphaPredictions({
      quotes: [stale],
      signals,
      buyLeads: generateBuyLeads([stale], 1),
      buyNow: [],
      algorithmScores: [councilScore],
      backtestResults: [backtest],
      tradingAgents: [{ ...agentDecision, rating: "Data Review", action: "Refresh data before any trade decision" }],
    });

    expect(predictions[0].action).toBe("Data Review");
    expect(predictions[0].blockers).toContain("Quote is stale or unavailable.");
  });
});
