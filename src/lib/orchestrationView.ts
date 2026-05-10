import type { OrchestrationRun } from "@/lib/orchestration";

export function normalizeOrchestrationRun(value: unknown): OrchestrationRun | null {
  if (!value || typeof value !== "object") return null;
  const run = value as Partial<OrchestrationRun>;
  const decision = run.decision;
  const governance = run.governance;
  if (!run.status || !decision || typeof decision !== "object") return null;
  if (!decision.paper || !decision.live) return null;
  if (!Array.isArray(run.stages)) return null;
  if (!governance || !Array.isArray(governance.referenceChecklist)) return null;
  return run as OrchestrationRun;
}
