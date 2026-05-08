import { describe, expect, it } from "vitest";
import { providerPlanNames } from "@/lib/providers";

describe("provider routing", () => {
  it("uses free/public providers before optional paid providers in auto mode", () => {
    const auto = providerPlanNames("auto");

    expect(auto.slice(0, 3)).toEqual(["fetchCommodityFutureQuote", "fetchCompositeStockQuote", "fetchBinanceQuote"]);
    expect(auto).not.toContain("fetchPolygonQuote");
    expect(auto).not.toContain("fetchTwelveDataQuote");
  });

  it("keeps an explicit paid-first mode available for licensed workflows", () => {
    const paid = providerPlanNames("paid");

    expect(paid.slice(0, 3)).toEqual(["fetchPolygonQuote", "fetchAlpacaQuote", "fetchTwelveDataQuote"]);
    expect(paid).toContain("fetchCompositeStockQuote");
  });
});
