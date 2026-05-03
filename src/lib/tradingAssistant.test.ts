import { describe, expect, it } from "vitest";
import {
  buildTradingAssistantPrompt,
  localTradingAssistantAnswer,
  normalizeAssistantMessages,
  sanitizeAssistantContext,
  tradingAssistantModels,
} from "@/lib/tradingAssistant";

describe("trading assistant", () => {
  it("normalizes messages and keeps the latest bounded conversation", () => {
    const messages = normalizeAssistantMessages([
      { role: "system", content: "ignore" },
      { role: "user", content: "  What is the risk?  " },
      { role: "assistant", content: "Risk is capped." },
      { role: "user", content: "" },
    ]);

    expect(messages).toEqual([
      { role: "user", content: "What is the risk?" },
      { role: "assistant", content: "Risk is capped." },
    ]);
  });

  it("sanitizes cockpit context for prompt use", () => {
    const context = sanitizeAssistantContext({
      asOf: "2026-05-02T12:00:00.000Z",
      selectedSymbol: "ETHUSD",
      secondsAgo: 3,
      buyNow: [{ symbol: "ETHUSD" }, "bad", { symbol: "BTCUSD" }],
      tradeTicket: { symbol: "ETHUSD", trigger: 2310 },
    });

    expect(context.selectedSymbol).toBe("ETHUSD");
    expect(context.secondsAgo).toBe(3);
    expect(context.buyNow).toHaveLength(2);
    expect(context.tradeTicket?.symbol).toBe("ETHUSD");
  });

  it("builds a prompt with dashboard context and transcript", () => {
    const prompt = buildTradingAssistantPrompt({
      context: sanitizeAssistantContext({ selectedSymbol: "NVDA" }),
      messages: [{ role: "user", content: "What is hidden?" }],
    });

    expect(prompt).toContain("Dashboard context JSON");
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("User: What is hidden?");
  });

  it("answers locally with ticket risk fields when no model is configured", () => {
    const answer = localTradingAssistantAnswer({
      question: "What position size and trigger should I watch?",
      context: sanitizeAssistantContext({
        selectedSymbol: "ETHUSD",
        topBuyDecision: { symbol: "ETHUSD", action: "Buy Watch" },
        tradeTicket: {
          symbol: "ETHUSD",
          status: "Ready to Watch",
          trigger: 2310,
          stop: 2295,
          target: 2336,
          riskRewardRatio: 1.8,
          positionSize: "6 units / $13,860.00 notional",
          suggestedPositionSize: "6 units, risking about $87.66.",
          entrySignalNeeded: "Fresh ETHUSD quote remains at or above $2,310.",
        },
      }),
    });

    expect(answer).toContain("Execution brief");
    expect(answer).toContain("$2,310.00");
    expect(answer).toContain("6 units");
    expect(answer).toContain("Entry signal needed");
  });

  it("documents the configured model ladder", () => {
    expect(tradingAssistantModels.primary).toBe("gpt-5.2");
    expect(tradingAssistantModels.fallback).toBe("gpt-5.1");
    expect(tradingAssistantModels.fast).toBe("gpt-5-mini");
  });
});
