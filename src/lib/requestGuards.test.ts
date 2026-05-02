import { describe, expect, it } from "vitest";
import { defaultSymbols, parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";

describe("requestGuards", () => {
  it("sanitizes symbols, deduplicates them, and caps the list", () => {
    const symbols = parseSymbols(" nvda, TSLA, ../../etc/passwd, BTCUSD, nvda, BAD SYMBOL, AAPL ", 4);

    expect(symbols).toEqual(["NVDA", "TSLA", "BTCUSD", "AAPL"]);
    expect(symbolsParam(symbols)).toBe("NVDA,TSLA,BTCUSD,AAPL");
  });

  it("falls back to the default watchlist when no symbols are supplied", () => {
    expect(parseSymbols(null)).toEqual(defaultSymbols.split(","));
  });

  it("rejects unknown provider names", () => {
    expect(parseProvider("nasdaq")).toBe("nasdaq");
    expect(parseProvider("polygon")).toBe("polygon");
    expect(parseProvider("twelvedata")).toBe("twelvedata");
    expect(parseProvider("file:///tmp/secret")).toBe("auto");
  });

  it("clamps numeric query parameters", () => {
    expect(parseNumberParam("1000", 10, 0, 100)).toBe(100);
    expect(parseNumberParam("-5", 10, 0, 100)).toBe(0);
    expect(parseNumberParam("not-a-number", 10, 0, 100)).toBe(10);
  });
});
