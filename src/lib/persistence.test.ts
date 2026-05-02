import { describe, expect, it } from "vitest";
import { validPaperTradePayload, validResearchNotePayload } from "@/lib/persistence";

const validPayload = {
  symbol: "NVDA",
  side: "Buy",
  entry: 100,
  stop: 97.5,
  target: 105,
  units: 10,
  maxLoss: 25,
  status: "Watching",
  notes: "Fresh paper-trade test.",
};

describe("persistence validation", () => {
  it("accepts a well-formed paper trade payload", () => {
    expect(validPaperTradePayload(validPayload)).toBe(true);
  });

  it("rejects unsafe symbols, empty units, invalid status, and oversized notes", () => {
    expect(validPaperTradePayload({ ...validPayload, symbol: "../../NVDA" })).toBe(false);
    expect(validPaperTradePayload({ ...validPayload, units: 0 })).toBe(false);
    expect(validPaperTradePayload({ ...validPayload, status: "Filled" })).toBe(false);
    expect(validPaperTradePayload({ ...validPayload, notes: "x".repeat(1001) })).toBe(false);
  });

  it("validates cross-device research notes", () => {
    expect(
      validResearchNotePayload({
        symbol: "AAPL",
        noteType: "journal",
        title: "Thesis check",
        body: "Official filing and current price need to agree before action.",
        tags: ["filing", "risk"],
      }),
    ).toBe(true);
    expect(validResearchNotePayload({ symbol: "../../AAPL", title: "x", body: "safe" })).toBe(false);
    expect(validResearchNotePayload({ symbol: "AAPL", title: "x".repeat(181), body: "safe" })).toBe(false);
    expect(validResearchNotePayload({ symbol: "AAPL", title: "safe", body: "x".repeat(5001) })).toBe(false);
  });
});
