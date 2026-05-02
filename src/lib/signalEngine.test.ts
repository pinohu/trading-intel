import { describe, expect, it } from "vitest";
import { generateBuyLead, generateSignal, type SignalQuote } from "@/lib/signalEngine";

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

describe("signalEngine", () => {
  it("promotes a fresh liquid momentum setup to buy watch", () => {
    const signal = generateSignal(quote());
    const lead = generateBuyLead(quote());

    expect(signal.action).toBe("Buy Watch");
    expect(signal.quality).toMatch(/A|B/);
    expect(signal.rewardRisk).toBeGreaterThanOrEqual(1.5);
    expect(lead.status).toBe("Buy Watch");
  });

  it("forces stale quote data to no-trade behavior", () => {
    const stale = quote({ updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    const signal = generateSignal(stale);
    const lead = generateBuyLead(stale);

    expect(signal.action).toBe("Hold/No Trade");
    expect(signal.dataFresh).toBe(false);
    expect(lead.status).toBe("No Buy");
    expect(lead.warnings.some((warning) => warning.includes("stale"))).toBe(true);
  });
});
