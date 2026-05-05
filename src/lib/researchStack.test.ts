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
    expect(keys).toContain("local-llm");
    expect(keys).toContain("openbb");
    expect(keys).toContain("openstock");
    expect(keys).toContain("akshare");
    expect(keys).toContain("tradingagents");
    expect(keys).toContain("stockpredictionai");
    expect(keys).toContain("stockpredictionmodels");
    expect(keys).toContain("lean");
    expect(keys).toContain("stocksharp");
    expect(keys).toContain("jesse");
    expect(keys).toContain("postgres");
  });

  it("documents applied free replacements for paid or hosted lanes", () => {
    const readiness = buildResearchStackReadiness();
    const optionalPaid = readiness.components.filter((component) => component.costProfile === "optional-paid");

    expect(readiness.freeReplacements.length).toBeGreaterThanOrEqual(6);
    expect(readiness.freeReplacements.every((replacement) => replacement.applied)).toBe(true);
    expect(readiness.freeReplacements.some((replacement) => replacement.replaces.includes("Paid LLM"))).toBe(true);
    expect(optionalPaid.every((component) => component.freeAlternative && component.freeAlternative.length > 0)).toBe(true);
  });
});
