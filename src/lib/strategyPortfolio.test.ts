import { describe, expect, it } from "vitest";
import { buildStrategyPortfolio } from "@/lib/strategyPortfolio";

describe("strategyPortfolio", () => {
  it("keeps strategies research-only without proof evidence", () => {
    const portfolio = buildStrategyPortfolio();

    expect(portfolio.summary.total).toBeGreaterThan(0);
    expect(portfolio.summary.liveEligible).toBe(0);
    expect(portfolio.strategies.every((strategy) => strategy.state === "research")).toBe(true);
  });

  it("promotes strong validated evidence into live eligibility", () => {
    const portfolio = buildStrategyPortfolio({
      databaseBacked: true,
      backtests: [
        {
          id: "bt-1",
          strategy: "daily-momentum-breakout",
          symbols: ["SPY", "QQQ"],
          metrics: {
            trades: 24,
            winRate: 58,
            totalReturnPct: 18,
            maxDrawdownPct: 6,
            profitFactor: 1.8,
          },
          results: [
            {
              symbol: "SPY",
              validation: {
                robustness: 11,
                outOfSample: { trades: 8, totalReturnPct: 9, maxDrawdownPct: 4 },
              },
            },
          ],
          status: "completed",
          created_at: "2026-05-09T01:00:00.000Z",
        },
      ],
    });

    const breakout = portfolio.strategies.find((strategy) => strategy.id === "daily-momentum-breakout");
    expect(breakout?.state).toBe("live-eligible");
    expect(breakout?.promotionBlockers).toEqual([]);
    expect(portfolio.summary.allocatedRiskPct).toBeGreaterThan(0);
  });

  it("keeps fragile evidence as paper candidate with blockers", () => {
    const portfolio = buildStrategyPortfolio({
      backtests: [
        {
          strategy: "daily-momentum-breakout",
          metrics: {
            trades: 4,
            winRate: 38,
            totalReturnPct: -2,
            maxDrawdownPct: 18,
            profitFactor: 0.7,
          },
          results: [],
          status: "completed",
          created_at: "2026-05-09T01:00:00.000Z",
        },
      ],
    });

    const breakout = portfolio.strategies.find((strategy) => strategy.id === "daily-momentum-breakout");
    expect(breakout?.state).toBe("research");
    expect(breakout?.promotionBlockers.length).toBeGreaterThan(2);
  });
});
