import { describe, expect, it } from "vitest";
import { recordAuditEvent } from "@/lib/audit";

describe("audit", () => {
  it("does not break request flow when persistence is not configured", async () => {
    await expect(recordAuditEvent("test.event", "test-actor", { ok: true })).resolves.toBeUndefined();
  });
});
