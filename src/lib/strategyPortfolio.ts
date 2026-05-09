import { databaseConfigured } from "@/lib/db";
import { listAutoResearchRuns, listStrategyBacktests } from "@/lib/persistence";

export type StrategyDeploymentState = "research" | "paper-candidate" | "paper-active" | "live-eligible" | "paused";

export type StrategyDefinition = {
  id: string;
  version: string;
  name: string;
  family: "breakout" | "mean-reversion" | "factor" | "agent" | "risk";
  description: string;
  defaultRiskBudgetPct: number;
  maxDrawdownLimitPct: number;
  promotionCriteria: {
    minTrades: number;
    minProfitFactor: number;
    minOutOfSampleTrades: number;
    maxDrawdownPct: number;
    minWinRate: number;
  };
};

export type StrategyPortfolioRow = StrategyDefinition & {
  state: StrategyDeploymentState;
  proofScore: number;
  latestBacktest: StrategyEvidence | null;
  lastEvaluatedAt: string | null;
  riskBudgetPct: number;
  allocationWeightPct: number;
  promotionBlockers: string[];
  demotionTriggers: string[];
};

export type StrategyPortfolio = {
  ok: boolean;
  generatedAt: string;
  databaseBacked: boolean;
  summary: {
    total: number;
    liveEligible: number;
    paperActive: number;
    paperCandidates: number;
    researchOnly: number;
    paused: number;
    allocatedRiskPct: number;
  };
  strategies: StrategyPortfolioRow[];
  recentChampions: Array<{
    id: string;
    name: string;
    score: number;
    createdAt: string;
  }>;
  advisory: string;
};

type StrategyEvidence = {
  id?: string;
  strategy: string;
  symbols: string[];
  metrics: {
    trades: number;
    winRate: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
  };
  validation: {
    outOfSampleTrades: number;
    outOfSampleReturnPct: number;
    robustness: number;
  } | null;
  status: string;
  createdAt: string | null;
};

const strategyDefinitions: StrategyDefinition[] = [
  {
    id: "daily-momentum-breakout",
    version: "1.0.0",
    name: "Daily Momentum Breakout",
    family: "breakout",
    description: "20-day breakout with slippage, fees, stop, target, and walk-forward holdout checks.",
    defaultRiskBudgetPct: 1,
    maxDrawdownLimitPct: 12,
    promotionCriteria: { minTrades: 10, minProfitFactor: 1.2, minOutOfSampleTrades: 3, maxDrawdownPct: 12, minWinRate: 45 },
  },
  {
    id: "tight-risk-fast-exit",
    version: "0.1.0",
    name: "Tight Risk, Fast Exit",
    family: "breakout",
    description: "AutoResearch variant with smaller stops and shorter holds for fast momentum failures.",
    defaultRiskBudgetPct: 0.5,
    maxDrawdownLimitPct: 8,
    promotionCriteria: { minTrades: 12, minProfitFactor: 1.25, minOutOfSampleTrades: 4, maxDrawdownPct: 8, minWinRate: 48 },
  },
  {
    id: "trend-hold-wide-stop",
    version: "0.1.0",
    name: "Trend Hold, Wider Stop",
    family: "breakout",
    description: "AutoResearch variant that accepts wider stops and longer holds to capture larger moves.",
    defaultRiskBudgetPct: 0.5,
    maxDrawdownLimitPct: 14,
    promotionCriteria: { minTrades: 10, minProfitFactor: 1.25, minOutOfSampleTrades: 3, maxDrawdownPct: 14, minWinRate: 42 },
  },
  {
    id: "fusion-alpha-consensus",
    version: "0.2.0",
    name: "Fusion Alpha Consensus",
    family: "factor",
    description: "Signal, factor, catalyst, backtest, and agent agreement layer. It ranks ideas but does not place orders.",
    defaultRiskBudgetPct: 0,
    maxDrawdownLimitPct: 0,
    promotionCriteria: { minTrades: 25, minProfitFactor: 1.3, minOutOfSampleTrades: 10, maxDrawdownPct: 10, minWinRate: 50 },
  },
  {
    id: "agent-paper-bracket",
    version: "0.1.0",
    name: "Agent Paper Bracket",
    family: "agent",
    description: "Strict buy-now gate that may submit paper bracket-limit orders when broker paper readiness and controls pass.",
    defaultRiskBudgetPct: 0.25,
    maxDrawdownLimitPct: 5,
    promotionCriteria: { minTrades: 30, minProfitFactor: 1.4, minOutOfSampleTrades: 10, maxDrawdownPct: 5, minWinRate: 50 },
  },
];

export function buildStrategyPortfolio({
  backtests = [],
  autoResearchRuns = [],
  databaseBacked = false,
  now = new Date(),
}: {
  backtests?: Array<Record<string, unknown>>;
  autoResearchRuns?: Array<Record<string, unknown>>;
  databaseBacked?: boolean;
  now?: Date;
} = {}): StrategyPortfolio {
  const evidenceByStrategy = new Map<string, StrategyEvidence>();
  for (const row of backtests) {
    const evidence = parseBacktestEvidence(row);
    if (!evidence) continue;
    const existing = evidenceByStrategy.get(evidence.strategy);
    if (!existing || Date.parse(evidence.createdAt ?? "") > Date.parse(existing.createdAt ?? "")) {
      evidenceByStrategy.set(evidence.strategy, evidence);
    }
  }

  const rows = strategyDefinitions.map((definition) => evaluateStrategy(definition, evidenceByStrategy.get(definition.id) ?? null));
  const allocatable = rows.filter((row) => row.state === "live-eligible" || row.state === "paper-active" || row.state === "paper-candidate");
  const scoreTotal = allocatable.reduce((sum, row) => sum + Math.max(1, row.proofScore), 0);
  const strategies = rows.map((row) => ({
    ...row,
    allocationWeightPct: scoreTotal > 0 && allocatable.includes(row) ? Number(((Math.max(1, row.proofScore) / scoreTotal) * 100).toFixed(2)) : 0,
  }));

  return {
    ok: true,
    generatedAt: now.toISOString(),
    databaseBacked,
    summary: {
      total: strategies.length,
      liveEligible: strategies.filter((row) => row.state === "live-eligible").length,
      paperActive: strategies.filter((row) => row.state === "paper-active").length,
      paperCandidates: strategies.filter((row) => row.state === "paper-candidate").length,
      researchOnly: strategies.filter((row) => row.state === "research").length,
      paused: strategies.filter((row) => row.state === "paused").length,
      allocatedRiskPct: Number(strategies.reduce((sum, row) => sum + row.riskBudgetPct, 0).toFixed(2)),
    },
    strategies,
    recentChampions: parseRecentChampions(autoResearchRuns),
    advisory: "Strategies are versioned research programs. Promotion requires out-of-sample proof, paper outcomes, drawdown controls, and operator-reviewed live gates.",
  };
}

export async function loadStrategyPortfolio(limit = 50) {
  if (!databaseConfigured()) {
    return buildStrategyPortfolio({ databaseBacked: false });
  }
  const [backtests, autoResearchRuns] = await Promise.all([
    listStrategyBacktests(limit).catch(() => []),
    listAutoResearchRuns(10).catch(() => []),
  ]);
  return buildStrategyPortfolio({
    backtests: backtests as Array<Record<string, unknown>>,
    autoResearchRuns: autoResearchRuns as Array<Record<string, unknown>>,
    databaseBacked: true,
  });
}

function evaluateStrategy(definition: StrategyDefinition, evidence: StrategyEvidence | null): StrategyPortfolioRow {
  if (!evidence) {
    return row(definition, "research", 15, null, [
      "No stored backtest evidence for this strategy version.",
      "Run historical validation before paper promotion.",
    ]);
  }

  const criteria = definition.promotionCriteria;
  const metrics = evidence.metrics;
  const validation = evidence.validation;
  const blockers = [
    metrics.trades < criteria.minTrades ? `Needs at least ${criteria.minTrades} trades; has ${metrics.trades}.` : "",
    metrics.profitFactor < criteria.minProfitFactor ? `Profit factor must be >= ${criteria.minProfitFactor}; current ${metrics.profitFactor}.` : "",
    metrics.maxDrawdownPct > criteria.maxDrawdownPct ? `Drawdown must stay <= ${criteria.maxDrawdownPct}%; current ${metrics.maxDrawdownPct}%.` : "",
    metrics.winRate < criteria.minWinRate ? `Win rate must be >= ${criteria.minWinRate}%; current ${metrics.winRate}%.` : "",
    !validation ? "Missing walk-forward/out-of-sample validation." : "",
    validation && validation.outOfSampleTrades < criteria.minOutOfSampleTrades
      ? `Needs ${criteria.minOutOfSampleTrades} out-of-sample trades; has ${validation.outOfSampleTrades}.`
      : "",
  ].filter(Boolean);
  const score = proofScore(evidence, definition);
  const state: StrategyDeploymentState =
    blockers.length === 0 && score >= 82
      ? "live-eligible"
      : blockers.length <= 1 && score >= 65
        ? "paper-active"
        : score >= 45
          ? "paper-candidate"
          : "research";
  return row(definition, state, score, evidence, blockers);
}

function row(
  definition: StrategyDefinition,
  state: StrategyDeploymentState,
  proofScore: number,
  evidence: StrategyEvidence | null,
  promotionBlockers: string[],
): StrategyPortfolioRow {
  return {
    ...definition,
    state,
    proofScore,
    latestBacktest: evidence,
    lastEvaluatedAt: evidence?.createdAt ?? null,
    riskBudgetPct: state === "live-eligible" || state === "paper-active" ? definition.defaultRiskBudgetPct : state === "paper-candidate" ? definition.defaultRiskBudgetPct / 2 : 0,
    allocationWeightPct: 0,
    promotionBlockers,
    demotionTriggers: [
      `Pause if drawdown exceeds ${definition.maxDrawdownLimitPct}%.`,
      "Pause after broker reconciliation mismatch or stale outcome attribution.",
      "Demote to research if out-of-sample performance turns negative across the latest validation run.",
    ],
  };
}

function proofScore(evidence: StrategyEvidence, definition: StrategyDefinition) {
  const metrics = evidence.metrics;
  const validation = evidence.validation;
  const tradeScore = Math.min(25, (metrics.trades / definition.promotionCriteria.minTrades) * 25);
  const profitScore = Math.min(25, (metrics.profitFactor / definition.promotionCriteria.minProfitFactor) * 20);
  const winScore = Math.min(15, (metrics.winRate / Math.max(1, definition.promotionCriteria.minWinRate)) * 12);
  const returnScore = Math.max(0, Math.min(15, metrics.totalReturnPct * 1.2));
  const drawdownPenalty = Math.max(0, metrics.maxDrawdownPct - definition.promotionCriteria.maxDrawdownPct) * 2;
  const validationScore = validation ? Math.min(20, validation.outOfSampleTrades * 3 + Math.max(0, validation.outOfSampleReturnPct)) : 0;
  return Math.max(0, Math.min(100, Number((tradeScore + profitScore + winScore + returnScore + validationScore - drawdownPenalty).toFixed(2))));
}

function parseBacktestEvidence(row: Record<string, unknown>): StrategyEvidence | null {
  const strategy = text(row.strategy);
  if (!strategy) return null;
  const metrics = record(row.metrics);
  const results = Array.isArray(row.results) ? (row.results as Array<Record<string, unknown>>) : [];
  const validation = strongestValidation(results);
  return {
    id: text(row.id) || undefined,
    strategy,
    symbols: Array.isArray(row.symbols) ? row.symbols.map(String) : [],
    metrics: {
      trades: number(metrics.trades),
      winRate: number(metrics.winRate),
      totalReturnPct: number(metrics.totalReturnPct),
      maxDrawdownPct: number(metrics.maxDrawdownPct),
      profitFactor: number(metrics.profitFactor),
    },
    validation,
    status: text(row.status),
    createdAt: text(row.created_at) || text(row.createdAt) || null,
  };
}

function strongestValidation(results: Array<Record<string, unknown>>) {
  const validations = results
    .map((result) => record(result.validation))
    .filter((validation) => Object.keys(validation).length > 0)
    .map((validation) => {
      const outOfSample = record(validation.outOfSample);
      return {
        outOfSampleTrades: number(outOfSample.trades),
        outOfSampleReturnPct: number(outOfSample.totalReturnPct),
        robustness: number(validation.robustness),
      };
    });
  if (!validations.length) return null;
  return validations.sort((a, b) => b.robustness - a.robustness)[0];
}

function parseRecentChampions(rows: Array<Record<string, unknown>>) {
  return rows
    .map((row) => {
      const champion = record(row.champion);
      const candidate = record(champion.candidate);
      return {
        id: text(candidate.id),
        name: text(candidate.name),
        score: number(champion.score),
        createdAt: text(row.created_at) || text(row.createdAt),
      };
    })
    .filter((item) => item.id && item.name)
    .slice(0, 5);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
