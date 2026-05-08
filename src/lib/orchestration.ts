import type { AgentTradeProposal, AgentTradingPolicy } from "@/lib/agentTrader";
import type { BrokerMode, ValidatedBrokerOrder } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import type { PreTradeControlResult } from "@/lib/executionControl";
import type { FusionPrediction } from "@/lib/fusionAlpha";
import { executionReferenceChecklist, minimumReferenceRewardRisk, referenceReportLessons } from "@/lib/referenceReports";
import { getControlValue, upsertControlValue } from "@/lib/persistence";

export type OrchestrationRunStatus = "ready-for-paper" | "needs-review" | "blocked" | "no-action";
export type OrchestrationStageStatus = "passed" | "warning" | "blocked" | "skipped";
export type OrchestrationStageKey = "research" | "thesis" | "backtest" | "risk" | "paper" | "live";
export type OrchestrationGateStatus = "ready" | "approval-required" | "blocked" | "skipped";

export type OrchestrationStage = {
  key: OrchestrationStageKey;
  label: string;
  owner: string;
  status: OrchestrationStageStatus;
  summary: string;
  evidence: string[];
};

export type OrchestrationExecutionGate = {
  status: OrchestrationGateStatus;
  riskApproved: boolean;
  manualApprovalRequired: boolean;
  reason: string;
};

export type OrchestrationDecision = {
  symbol: string | null;
  action: string;
  direction: "buy" | "sell" | "hold" | "review" | "none";
  confidence: number;
  thesis: string;
  paper: OrchestrationExecutionGate;
  live: OrchestrationExecutionGate;
  nextAction: string;
};

export type OrchestrationRun = {
  id: string;
  status: OrchestrationRunStatus;
  mode: BrokerMode;
  provider: string;
  symbols: string[];
  createdAt: string;
  source: "control-plane-v1";
  stages: OrchestrationStage[];
  decision: OrchestrationDecision;
  governance: {
    liveAutonomyAllowed: boolean;
    liveRequiresManualApproval: true;
    noLiveWithoutRiskApproval: true;
    referenceReportsApplied: string[];
    referenceChecklist: string[];
  };
};

type BuildOrchestrationRunInput = {
  mode: BrokerMode;
  provider: string;
  symbols: string[];
  predictions: FusionPrediction[];
  proposals?: AgentTradeProposal[];
  policy?: AgentTradingPolicy | null;
  paperPreTrade?: PreTradeControlResult | null;
  validatedPaperOrder?: ValidatedBrokerOrder | null;
  backtestResults?: Array<{ symbol: string; status?: string; trades?: number; totalReturnPct?: number; maxDrawdownPct?: number; profitFactor?: number }>;
  now?: Date;
};

type BacktestEvidence = NonNullable<BuildOrchestrationRunInput["backtestResults"]>[number];

const storageKey = "orchestration-runs-v1";
let memoryRuns: OrchestrationRun[] = [];

export function buildOrchestrationRun({
  mode,
  provider,
  symbols,
  predictions,
  proposals = [],
  policy = null,
  paperPreTrade = null,
  validatedPaperOrder = null,
  backtestResults = [],
  now = new Date(),
}: BuildOrchestrationRunInput): OrchestrationRun {
  const createdAt = now.toISOString();
  const prediction = selectPrimaryPrediction(predictions);
  const proposal = prediction ? proposals.find((item) => item.symbol === prediction.symbol) : proposals[0];
  const backtest = prediction ? backtestResults.find((item) => item.symbol === prediction.symbol) : null;
  const risk = evaluateRiskStage({ prediction, proposal, paperPreTrade, validatedPaperOrder });
  const paper = evaluatePaperDecision({ riskApproved: risk.approved, proposal, policy, paperPreTrade });
  const live = evaluateLiveDecision({ riskApproved: risk.approved, liveAutonomyAllowed: Boolean(policy?.liveAutonomyAllowed) });

  const stages = [
    researchStage(predictions, provider),
    thesisStage(prediction),
    backtestStage(backtest),
    riskStage(risk),
    paperStage(paper, policy),
    liveStage(live),
  ];
  const status = runStatus({ prediction, riskApproved: risk.approved, paper });

  return {
    id: `orch-${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${(prediction?.symbol ?? "watchlist").toLowerCase()}`,
    status,
    mode,
    provider,
    symbols,
    createdAt,
    source: "control-plane-v1",
    stages,
    decision: {
      symbol: prediction?.symbol ?? null,
      action: prediction?.action ?? "No decision",
      direction: prediction?.direction ?? "none",
      confidence: prediction?.confidence ?? 0,
      thesis: prediction?.thesis ?? "No Fusion Alpha prediction was available for this control-plane run.",
      paper,
      live,
      nextAction: nextAction({ prediction, riskApproved: risk.approved, paper, live }),
    },
    governance: {
      liveAutonomyAllowed: Boolean(policy?.liveAutonomyAllowed),
      liveRequiresManualApproval: true,
      noLiveWithoutRiskApproval: true,
      referenceReportsApplied: referenceReportLessons.map((lesson) => lesson.title),
      referenceChecklist: executionReferenceChecklist(),
    },
  };
}

export function evaluateLiveDecision({
  riskApproved,
  liveAutonomyAllowed = false,
}: {
  riskApproved: boolean;
  liveAutonomyAllowed?: boolean;
}): OrchestrationExecutionGate {
  if (!riskApproved) {
    return {
      status: "blocked",
      riskApproved: false,
      manualApprovalRequired: true,
      reason: "Live order blocked: the risk reviewer has not approved this run.",
    };
  }

  if (!liveAutonomyAllowed) {
    return {
      status: "approval-required",
      riskApproved: true,
      manualApprovalRequired: true,
      reason: "Risk approved the idea, but live execution still requires the manual broker rail.",
    };
  }

  return {
    status: "ready",
    riskApproved: true,
    manualApprovalRequired: true,
    reason: "Risk approved. Live-agent rail is armed, but an operator acknowledgement remains required before real-money submission.",
  };
}

export async function listOrchestrationRuns(limit = 5): Promise<OrchestrationRun[]> {
  const safeLimit = clampInteger(limit, 1, 25);
  if (!databaseConfigured()) return memoryRuns.slice(0, safeLimit);

  try {
    const stored = await getControlValue<{ runs?: OrchestrationRun[] }>(storageKey);
    return (stored?.runs ?? []).slice(0, safeLimit);
  } catch {
    return [];
  }
}

export async function storeOrchestrationRun(run: OrchestrationRun, limit = 10) {
  const safeLimit = clampInteger(limit, 1, 25);
  if (!databaseConfigured()) {
    memoryRuns = [run, ...memoryRuns.filter((item) => item.id !== run.id)].slice(0, safeLimit);
    return { stored: false, runs: memoryRuns };
  }

  const current = await listOrchestrationRuns(safeLimit);
  const runs = [run, ...current.filter((item) => item.id !== run.id)].slice(0, safeLimit);
  const row = await upsertControlValue(storageKey, { runs });
  return { stored: true, runs: (row.value as { runs?: OrchestrationRun[] }).runs ?? runs };
}

function selectPrimaryPrediction(predictions: FusionPrediction[]) {
  return (
    predictions.find((prediction) => prediction.direction === "buy" && prediction.action !== "Data Review") ??
    predictions.find((prediction) => prediction.direction === "buy") ??
    predictions[0] ??
    null
  );
}

function evaluateRiskStage({
  prediction,
  proposal,
  paperPreTrade,
  validatedPaperOrder,
}: {
  prediction: FusionPrediction | null;
  proposal?: AgentTradeProposal;
  paperPreTrade: PreTradeControlResult | null;
  validatedPaperOrder: ValidatedBrokerOrder | null;
}) {
  const blockers = [
    !prediction ? "Fusion Alpha did not return a primary prediction." : "",
    prediction && prediction.direction !== "buy" ? "Primary decision is not a buy candidate." : "",
    prediction?.action === "Data Review" ? "Fusion Alpha requires a data review before action." : "",
    ...(prediction?.blockers ?? []),
    !proposal ? "No agent trade proposal exists for the primary prediction." : "",
    proposal && proposal.status !== "paper-ready" ? `Proposal is ${proposal.status}.` : "",
    prediction && (!prediction.entry || !prediction.stop || !prediction.target) ? "Entry, stop, and target are not all present." : "",
    prediction?.rewardRisk !== null && prediction?.rewardRisk !== undefined && prediction.rewardRisk < minimumReferenceRewardRisk
      ? `Reward/risk is ${prediction.rewardRisk}R; reference reports require at least ${minimumReferenceRewardRisk}R before promotion.`
      : "",
    prediction && prediction.forecast.maxLoss <= 0 ? "Max loss is not quantified." : "",
    prediction && prediction.forecast.units <= 0 ? "Suggested position size is not quantified." : "",
    prediction && prediction.forecast.notional <= 0 ? "Potential position notional is not quantified." : "",
    prediction && prediction.confidence < 68 ? "Fusion confidence is below the V1 risk approval floor." : "",
    !validatedPaperOrder ? "Paper order could not be validated for risk review." : "",
    ...(paperPreTrade?.blockers ?? []),
  ].filter(Boolean);

  return {
    approved: blockers.length === 0,
    blockers,
  };
}

function evaluatePaperDecision({
  riskApproved,
  proposal,
  policy,
  paperPreTrade,
}: {
  riskApproved: boolean;
  proposal?: AgentTradeProposal;
  policy: AgentTradingPolicy | null;
  paperPreTrade: PreTradeControlResult | null;
}): OrchestrationExecutionGate {
  if (!riskApproved) {
    return {
      status: "blocked",
      riskApproved: false,
      manualApprovalRequired: false,
      reason: "Paper order blocked until research, thesis, backtest, and risk checks agree.",
    };
  }
  if (!proposal || proposal.status !== "paper-ready") {
    return {
      status: "blocked",
      riskApproved: true,
      manualApprovalRequired: false,
      reason: "No paper-ready proposal exists for the selected idea.",
    };
  }
  if (!policy?.paperAutomationReady) {
    return {
      status: "approval-required",
      riskApproved: true,
      manualApprovalRequired: false,
      reason: "Risk approved, but paper broker automation is not armed.",
    };
  }
  if (paperPreTrade && !paperPreTrade.ok) {
    return {
      status: "blocked",
      riskApproved: true,
      manualApprovalRequired: false,
      reason: "Pre-trade controls blocked the paper order.",
    };
  }
  return {
    status: "ready",
    riskApproved: true,
    manualApprovalRequired: false,
    reason: "Paper order is approved by the V1 orchestration chain.",
  };
}

function researchStage(predictions: FusionPrediction[], provider: string): OrchestrationStage {
  return {
    key: "research",
    label: "Research",
    owner: "Research agents",
    status: predictions.length ? "passed" : "blocked",
    summary: predictions.length ? `${predictions.length} Fusion Alpha prediction(s) from ${provider}.` : "No research predictions returned.",
    evidence: predictions.slice(0, 3).map((item) => `${item.symbol}: ${item.score}/100, ${item.confidence}/100 confidence`),
  };
}

function thesisStage(prediction: FusionPrediction | null): OrchestrationStage {
  return {
    key: "thesis",
    label: "Thesis",
    owner: "Strategy desk",
    status: prediction?.thesis ? "passed" : "blocked",
    summary: prediction ? `${prediction.symbol} thesis compiled.` : "No thesis available.",
    evidence: prediction ? [prediction.thesis] : [],
  };
}

function backtestStage(backtest: BacktestEvidence | null | undefined): OrchestrationStage {
  if (!backtest) {
    return {
      key: "backtest",
      label: "Backtest",
      owner: "Backtest agent",
      status: "warning",
      summary: "No symbol-specific backtest was available for this run.",
      evidence: ["Proceed as research-only until historical evidence is attached."],
    };
  }
  const acceptable = backtest.status === "ok" && Number(backtest.trades ?? 0) > 0 && Number(backtest.maxDrawdownPct ?? 100) <= 25;
  return {
    key: "backtest",
    label: "Backtest",
    owner: "Backtest agent",
    status: acceptable ? "passed" : "warning",
    summary: `${backtest.symbol} ${backtest.status ?? "unknown"}: ${backtest.trades ?? 0} trade(s), PF ${backtest.profitFactor ?? "n/a"}.`,
    evidence: [`Return ${backtest.totalReturnPct ?? 0}%`, `Max drawdown ${backtest.maxDrawdownPct ?? 0}%`],
  };
}

function riskStage(risk: { approved: boolean; blockers: string[] }): OrchestrationStage {
  return {
    key: "risk",
    label: "Risk",
    owner: "Risk reviewer",
    status: risk.approved ? "passed" : "blocked",
    summary: risk.approved ? "Risk reviewer approved the paper candidate." : "Risk reviewer blocked execution.",
    evidence: risk.approved
      ? ["Order shape, confidence, max loss, reference-report checklist, and pre-trade controls passed.", ...executionReferenceChecklist().slice(0, 2)]
      : risk.blockers.slice(0, 5),
  };
}

function paperStage(paper: OrchestrationExecutionGate, policy: AgentTradingPolicy | null): OrchestrationStage {
  return {
    key: "paper",
    label: "Paper",
    owner: "Paper execution agent",
    status: gateToStageStatus(paper),
    summary: paper.reason,
    evidence: policy?.missing?.length ? policy.missing.slice(0, 3) : ["Paper automation policy evaluated."],
  };
}

function liveStage(live: OrchestrationExecutionGate): OrchestrationStage {
  return {
    key: "live",
    label: "Live",
    owner: "Broker rail",
    status: gateToStageStatus(live),
    summary: live.reason,
    evidence: live.status === "ready"
      ? ["Live-agent trading is armed for operator-triggered requests.", "Manual acknowledgement and broker controls remain mandatory."]
      : ["Live-agent trading is locked until explicitly armed.", "Manual acknowledgement and broker controls remain mandatory."],
  };
}

function gateToStageStatus(gate: OrchestrationExecutionGate): OrchestrationStageStatus {
  if (gate.status === "ready") return "passed";
  if (gate.status === "approval-required") return "warning";
  if (gate.status === "skipped") return "skipped";
  return "blocked";
}

function runStatus({
  prediction,
  riskApproved,
  paper,
}: {
  prediction: FusionPrediction | null;
  riskApproved: boolean;
  paper: OrchestrationExecutionGate;
}): OrchestrationRunStatus {
  if (!prediction || prediction.direction === "hold" || prediction.direction === "review") return "no-action";
  if (!riskApproved) return "blocked";
  if (paper.status === "ready") return "ready-for-paper";
  return "needs-review";
}

function nextAction({
  prediction,
  riskApproved,
  paper,
  live,
}: {
  prediction: FusionPrediction | null;
  riskApproved: boolean;
  paper: OrchestrationExecutionGate;
  live: OrchestrationExecutionGate;
}) {
  if (!prediction) return "Run research again with a fresh watchlist.";
  if (prediction.direction !== "buy") return `${prediction.symbol}: no buy action. Review sell/avoid evidence only.`;
  if (!riskApproved) return `${prediction.symbol}: fix risk blockers before paper or live execution.`;
  if (live.status === "ready") {
    return paper.status === "ready"
      ? `${prediction.symbol}: paper execution can run; live agent can submit only after operator acknowledgement.`
      : `${prediction.symbol}: live agent can submit only after operator acknowledgement; paper gate is ${paper.status}.`;
  }
  if (paper.status === "ready") return `${prediction.symbol}: paper execution can run; live agent remains locked until armed.`;
  if (live.status === "approval-required") return `${prediction.symbol}: risk approved, but live-agent controls are not fully armed.`;
  return `${prediction.symbol}: review broker/paper automation gates.`;
}

function clampInteger(value: number, min: number, max: number) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}
