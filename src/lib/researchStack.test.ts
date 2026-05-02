import { describe, expect, it } from "vitest";
import { buildResearchStackReadiness } from "@/lib/researchStack";

describe("research stack readiness", () => {
  it("includes credentialed providers, free fallbacks, external workers, and durable database lanes", () => {
    const readiness = buildResearchStackReadiness();
    const keys = readiness.components.map((component) => component.key);

    expect(readiness.ok).toBe(true);
    expect(keys).toContain("polygon");
    expect(keys).toContain("twelvedata");
    expect(keys).toContain("sec-edgar");
    expect(keys).toContain("openbb");
    expect(keys).toContain("lean");
    expect(keys).toContain("jesse");
    expect(keys).toContain("postgres");
  });
});
