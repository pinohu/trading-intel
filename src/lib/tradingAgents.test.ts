import { describe, expect, it } from "vitest";
import { formatTradingAgentsNote, normalizeTradingAgentsDecisions, parseTradingAgentsSymbols } from "@/lib/tradingAgents";

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
});
