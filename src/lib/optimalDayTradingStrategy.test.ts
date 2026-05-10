import { describe, expect, it } from "vitest";
import { evaluateOptimalDayTradingStrategy } from "@/lib/optimalDayTradingStrategy";
import { generateBuyLead, generateSignal, type SignalQuote } from "@/lib/signalEngine";

const baseInput = {
  symbol: "NVDA",
  market: "Stock/ETF" as const,
  price: 101.8,
  open: 100,
  high: 102,
  low: 99,
  range: 3,
  closeLocation: 0.93,
  vwapProxy: 100.93,
  dayMovePct: 1.8,
  changePct: 1.8,
  volume: 10_000_000,
  liquid: true,
  fresh: true,
  inTradingWindow: true,
  rewardRisk: 1.8,
  hasCatalyst: false,
  quality: "Execution Grade",
  rangeEstimated: false,
  extended: false,
  failedBreakout: false,
  severeWeakness: false,
};

function quote(overrides: Partial<SignalQuote> = {}): SignalQuote {
  return {
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
    ...overrides,
  };
}

describe("optimal day-trading strategy", () => {
  it("combines the best intraday setups into a buy-watch stance", () => {
    const fit = evaluateOptimalDayTradingStrategy(baseInput);

    expect(fit.stance).toBe("buy-watch");
    expect(fit.matchedSetups.map((setup) => setup.name)).toContain("VWAP Trend Continuation");
    expect(fit.matchedSetups.map((setup) => setup.name)).toContain("Opening Range Breakout");
    expect(fit.riskMode).toBe("standard");
  });

  it("blocks promotion when reward/risk and freshness fail", () => {
    const fit = evaluateOptimalDayTradingStrategy({
      ...baseInput,
      fresh: false,
      rewardRisk: 0.8,
    });

    expect(fit.stance).toBe("blocked");
    expect(fit.riskMode).toBe("stand-aside");
    expect(fit.blockers.some((blocker) => blocker.includes("stale"))).toBe(true);
    expect(fit.blockers.some((blocker) => blocker.includes("Reward/risk"))).toBe(true);
  });

  it("is automatically applied to generated signals and buy leads", () => {
    const signal = generateSignal(quote());
    const lead = generateBuyLead(quote());

    expect(signal.optimalStrategy.modelVersion).toBe("optimal-day-trading-v1");
    expect(signal.confirmations.some((confirmation) => confirmation.includes("Optimal composite strategy"))).toBe(true);
    expect(lead.optimalStrategy.stance).toBe("buy-watch");
    expect(lead.simpleWhy.some((line) => line.includes("Optimal composite strategy"))).toBe(true);
  });
});
