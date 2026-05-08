import { describe, expect, it } from "vitest";
import {
  criticalUnresolvedTrustGaps,
  sortedTrustGaps,
  trustOperationGaps,
  trustSummary,
  unresolvedTrustGaps,
} from "@/lib/trustOperations";

describe("trust operations matrix", () => {
  it("keeps every Trust Matrix issue live-tracked while separating proof readiness", () => {
    const summary = trustSummary();

    expect(summary.total).toBe(trustOperationGaps.length);
    expect(summary.live).toBe(trustOperationGaps.length);
    expect(trustOperationGaps.every((gap) => gap.status === "Live")).toBe(true);
    expect(summary.unresolved).toBe(unresolvedTrustGaps().length);
    expect(summary.criticalUnresolved).toBe(criticalUnresolvedTrustGaps().length);
    expect(summary.resolved).toBe(trustOperationGaps.filter((gap) => gap.proofStatus === "Live").length);
    expect(summary.criticalUnresolved).toBeLessThan(summary.critical);
  });

  it("keeps durable proof as an explicit critical open issue", () => {
    const durableProof = trustOperationGaps.find((gap) => gap.capability === "Durable outcome proof");

    expect(durableProof).toBeDefined();
    expect(durableProof?.priority).toBe("Critical");
    expect(durableProof?.status).toBe("Live");
    expect(durableProof?.proofStatus).toBe("Partial");
    expect(durableProof?.evidenceStandard).toContain("slippage");
    expect(durableProof?.evidenceStandard).toContain("fees");
    expect(durableProof?.evidenceStandard).toContain("regimes");
  });

  it("requires proof standards and acceptance criteria for every row", () => {
    const invalidRows = trustOperationGaps.filter(
      (gap) =>
        gap.capability.trim().length === 0 ||
        gap.issue.trim().length === 0 ||
        gap.status !== "Live" ||
        gap.evidenceStandard.trim().length === 0 ||
        gap.acceptanceCriteria.length === 0 ||
        gap.acceptanceCriteria.some((criterion) => criterion.trim().length === 0),
    );

    expect(invalidRows).toEqual([]);
  });

  it("sorts open trust issues before live monitoring rows", () => {
    const sorted = sortedTrustGaps();
    const firstProvenIndex = sorted.findIndex((gap) => gap.proofStatus === "Live");
    const lastOpenIndex = Math.max(...sorted.map((gap, index) => (gap.proofStatus === "Live" ? -1 : index)));

    expect(firstProvenIndex).toBeGreaterThan(lastOpenIndex);
  });
});
