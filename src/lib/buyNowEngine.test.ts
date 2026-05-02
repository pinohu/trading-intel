import { describe, expect, it } from "vitest";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import type { SignalQuote } from "@/lib/signalEngine";

const baseQuote: SignalQuote = {
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

describe("buyNowEngine", () => {
  it("only emits buy-now when trigger, freshness, confidence, and sizing pass", () => {
    const result = generateBuyNowSignals({
      quotes: [baseQuote],
      accountSize: 10000,
      riskPct: 1,
      maxDailyLossPct: 3,
    });

    expect(result.buyNow).toHaveLength(1);
    expect(result.buyNow[0].symbol).toBe("NVDA");
    expect(result.buyNow[0].ticket.tradeable).toBe(true);
    expect(result.buyNow[0].maxLoss).toBeLessThanOrEqual(100);
  });

  it("keeps stale data in the blocked list instead of promoting it", () => {
    const result = generateBuyNowSignals({
      quotes: [{ ...baseQuote, updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }],
      accountSize: 10000,
      riskPct: 1,
      maxDailyLossPct: 3,
    });

    expect(result.buyNow).toHaveLength(0);
    expect(result.blocked[0].blockers).toContain("Quote is stale.");
  });
});
