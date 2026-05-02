import { describe, expect, it } from "vitest";
import type { BacktestSymbolResult } from "@/lib/backtesting";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";
import { formatTradingAgentsNote, normalizeTradingAgentsDecisions, parseTradingAgentsSymbols } from "@/lib/tradingAgents";
import { buildNativeTradingAgentsDebate, NATIVE_TRADING_AGENTS_SOURCE } from "@/lib/tradingAgentsNative";
import type { SignalQuote, TradeSignal } from "@/lib/signalEngine";

describe("TradingAgents adapter", () => {
  it("cleans symbols for bounded external worker runs", () => {
    expect(parseTradingAgentsSymbols("nvda, spy, bad symbol, BTCUSD")).toEqual(["NVDA", "SPY", "BTCUSD"]);
  });

  it("normalizes flexible worker decision payloads", () => {
    const decisions = normalizeTradingAgentsDecisions(
      {
        decisions: [
          {
            symbol: "NVDA",
            rating: "Overweight",
            action: "Research Buy Watch",
            thesis: "Demand and margins remain strong.",
            risks: ["Crowded positioning", "Valuation compression"],
            portfolioDecision: "Approve for paper watch only.",
          },
        ],
      },
      ["NVDA"],
    );

    expect(decisions[0]).toMatchObject({
      symbol: "NVDA",
      rating: "Overweight",
      action: "Research Buy Watch",
      portfolioDecision: "Approve for paper watch only.",
    });
    expect(formatTradingAgentsNote(decisions[0], "2026-05-01", "standard")).toContain("Research-only output");
  });

  it("builds native in-code debate decisions without a worker URL", () => {
    const quote: SignalQuote = {
      symbol: "NVDA",
      name: "NVIDIA",
      price: 198,
      change: 2.5,
      changePct: 1.28,
      open: 195,
      high: 199,
      low: 194,
      volume: 50_000_000,
      source: "test-feed",
      quality: "Execution Grade",
      updatedAt: new Date().toISOString(),
      marketStatus: "open",
    };
    const signal: TradeSignal = {
      symbol: "NVDA",
      name: "NVIDIA",
      action: "Buy Watch",
      market: "Stock/ETF",
      setup: "VWAP Trend Continuation",
      confidence: 82,
      quality: "A",
      urgency: "High",
      price: 198,
      invalidation: 193,
      target: 208,
      rewardRisk: 2,
      positionRiskPct: 1,
      reason: "Trend, range location, liquidity, and risk/reward align.",
      confirmations: ["Price above open", "Liquidity filter passed"],
      warnings: [],
      dataFresh: true,
      dataAgeMinutes: 1,
      checklist: ["Confirm catalyst"],
      generatedAt: new Date().toISOString(),
    };
    const score: AlgorithmCouncilScore = {
      symbol: "NVDA",
      name: "NVIDIA",
      sector: "Technology",
      recommendation: "Strong Buy Watch",
      ensembleScore: 84,
      confidence: 81,
      dataCoveragePct: 92,
      modelVersion: "test",
      factorScores: [
        { name: "Momentum / Tape", score: 88, weight: 0.16, rationale: ["strong tape"] },
        { name: "Quality", score: 82, weight: 0.2, rationale: ["high quality"] },
      ],
      thesis: "Momentum and quality are aligned.",
      bearCase: "Valuation compression remains the main risk.",
      plainAction: "Watch for a controlled entry.",
      riskControls: ["Keep size bounded."],
      sources: ["test"],
      generatedAt: new Date().toISOString(),
    };
    const backtest: BacktestSymbolResult = {
      symbol: "NVDA",
      bars: 180,
      trades: 8,
      winRate: 62.5,
      avgReturnPct: 1.4,
      totalReturnPct: 11.2,
      maxDrawdownPct: 4.1,
      profitFactor: 1.8,
      status: "ok",
    };

    const debate = buildNativeTradingAgentsDebate({ symbol: "NVDA", quote, signal, score, backtest, depth: "standard" });

    expect(NATIVE_TRADING_AGENTS_SOURCE).toBe("native-codebase-debate");
    expect(debate.decision.rating).toBe("Research Buy Watch");
    expect(debate.decision.portfolioDecision).toContain("broker controls");
    expect(debate.transcript.map((vote) => vote.agent)).toContain("Portfolio Manager");
  });
});
