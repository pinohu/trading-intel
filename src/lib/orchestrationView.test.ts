import { describe, expect, it } from "vitest";
import { buildOrchestrationRun } from "@/lib/orchestration";
import { normalizeOrchestrationRun } from "@/lib/orchestrationView";

describe("orchestration dashboard view helpers", () => {
  it("rejects partial persisted runs instead of letting the dashboard dereference missing fields", () => {
    expect(normalizeOrchestrationRun(null)).toBeNull();
    expect(normalizeOrchestrationRun({ status: "blocked" })).toBeNull();
    expect(
      normalizeOrchestrationRun({
        status: "ready-for-paper",
        decision: { symbol: "NVDA", paper: { status: "ready" } },
        stages: [],
      }),
    ).toBeNull();
  });

  it("accepts complete control-plane runs", () => {
    const run = buildOrchestrationRun({
      mode: "paper",
      provider: "test",
      symbols: [],
      predictions: [],
      now: new Date("2026-05-10T00:00:00.000Z"),
    });

    expect(normalizeOrchestrationRun(run)?.id).toBe(run.id);
  });
});
