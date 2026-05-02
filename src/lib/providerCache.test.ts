import { describe, expect, it } from "vitest";
import { getCachedQuote, quoteCacheStats, setCachedQuote } from "@/lib/providerCache";
import type { ProviderQuote } from "@/lib/providers";

const quote: ProviderQuote = {
  symbol: "NVDA",
  name: "NVIDIA",
  price: 100,
  change: 1,
  changePct: 1,
  open: 99,
  high: 101,
  low: 98,
  volume: 1_000_000,
  source: "test",
  quality: "Public Real-Time",
  updatedAt: new Date().toISOString(),
};

describe("providerCache", () => {
  it("returns live entries and expires stale entries", () => {
    setCachedQuote("test:NVDA", quote, 50);
    expect(getCachedQuote("test:NVDA")).toEqual(quote);
    expect(quoteCacheStats().liveEntries).toBeGreaterThanOrEqual(1);

    setCachedQuote("expired:NVDA", quote, -1);
    expect(getCachedQuote("expired:NVDA")).toBeNull();
  });
});
