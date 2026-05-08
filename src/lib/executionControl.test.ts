import { describe, expect, it } from "vitest";
import { defaultTradingControlState } from "@/lib/executionControl";

describe("execution controls", () => {
  it("allows authenticated manual live orders by default", () => {
    expect(defaultTradingControlState.allowLiveOrders).toBe(true);
    expect(defaultTradingControlState.allowLiveAgentOrders).toBe(false);
  });
});
