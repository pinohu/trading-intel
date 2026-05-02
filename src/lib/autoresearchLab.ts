import { runMomentumBreakoutBacktest, type BacktestResult } from "@/lib/backtesting";
import type { BrokerMode } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { insertAutoResearchRun, listAutoResearchRuns } from "@/lib/persistence";

export type AutoResearchCandidate = {
  id: string;
  name: string;
  hypothesis: string;
  assumptions: {
    slippageBps: number;
    feeBps: number;
    maxHoldBars: number;
    stopPct: number;
    rewardRisk: number;
  };
};

export type AutoResearchExperiment = {
  candidate: AutoResearchCandidate;
  score: number;
  verdict: "champion" | "promising" | "reject";
  metrics: BacktestResult["metrics"];
  risks: string[];
};

export type AutoResearchLabResult = {
  ok: true;
  runLabel: string;
  mode: BrokerMode;
  symbols: string[];
  lookbackDays: number;
  budget: number;
  champion: AutoResearchExperiment | null;
  experiments: AutoResearchExperiment[];
  guardrails: string[];
  storedRun?: Record<string, unknown> | null;
  advisory: string;
};

export const autoResearchCandidates: AutoResearchCandidate[] = [
  {
    id: "baseline-breakout",
    name: "Baseline Breakout",
    hypothesis: "A 20-day breakout with normal slippage can find trend continuation without overfitting.",
    assumptions: { slippageBps: 5, feeBps: 1, maxHoldBars: 5, stopPct: 2, rewardRisk: 2 },
  },
  {
    id: "tight-risk-fast-exit",
    name: "Tight Risk, Fast Exit",
    hypothesis: "Smaller stops and shorter holds reduce drawdown when momentum fades quickly.",
    assumptions: { slippageBps: 6, feeBps: 1, maxHoldBars: 3, stopPct: 1.35, rewardRisk: 1.8 },
  },
  {
    id: "trend-hold-wide-stop",
    name: "Trend Hold, Wider Stop",
    hypothesis: "Longer holds with wider stops capture larger moves, but only if drawdown stays tolerable.",
    assumptions: { slippageBps: 6, feeBps: 1, maxHoldBars: 8, stopPct: 2.6, rewardRisk: 2.4 },
  },
  {
    id: "high-friction-proof",
    name: "High Friction Proof",
    hypothesis: "A candidate that survives more slippage and fees is less likely to be a fragile backtest artifact.",
    assumptions: { slippageBps: 12, feeBps: 3, maxHoldBars: 5, stopPct: 2, rewardRisk: 2 },
  },
  {
    id: "low-target-consistency",
    name: "Low Target Consistency",
    hypothesis: "Lower reward targets may raise hit rate enough to improve realized expectancy.",
    assumptions: { slippageBps: 5, feeBps: 1, maxHoldBars: 4, stopPct: 1.8, rewardRisk: 1.4 },
  },
];

const guardrails = [
  "Research-only: this lab does not place broker orders.",
  "Champion means best tested candidate in this bounded run, not a profit guarantee.",
  "Promotion requires out-of-sample validation, paper trading, slippage/fee checks, and risk-ticket controls.",
  "RL and LLM-generated variants stay paper-only until independently validated.",
];

export function scoreAutoResearchExperiment(metrics: BacktestResult["metrics"]) {
  const tradePenalty = metrics.trades < 5 ? (5 - metrics.trades) * 8 : 0;
  const drawdownPenalty = Math.max(0, metrics.maxDrawdownPct - 8) * 2.5;
  const profitFactorScore = Math.min(35, metrics.profitFactor * 12);
  const winRateScore = Math.min(25, Math.max(0, metrics.winRate - 35) * 0.75);
  const returnScore = Math.max(-25, Math.min(35, metrics.totalReturnPct * 1.6 + metrics.avgReturnPct * 4));
  return Number((profitFactorScore + winRateScore + returnScore - drawdownPenalty - tradePenalty).toFixed(2));
}

export async function runAutoResearchLab({
  symbols,
  lookbackDays = 180,
  budget = 3,
  mode = "paper",
}: {
  symbols: string[];
  lookbackDays?: number;
  budget?: number;
  mode?: BrokerMode;
}): Promise<AutoResearchLabResult> {
  const cleanSymbols = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).slice(0, 8);
  const runBudget = Math.max(1, Math.min(Math.round(budget), autoResearchCandidates.length));
  const candidates = autoResearchCandidates.slice(0, runBudget);
  const experiments: AutoResearchExperiment[] = [];

  for (const candidate of candidates) {
    const result = await runMomentumBreakoutBacktest({
      symbols: cleanSymbols,
      lookbackDays,
      mode,
      ...candidate.assumptions,
    });
    const score = scoreAutoResearchExperiment(result.metrics);
    experiments.push({
      candidate,
      score,
      verdict: "reject",
      metrics: result.metrics,
      risks: experimentRisks(result.metrics),
    });
  }

  const sorted = [...experiments].sort((a, b) => b.score - a.score);
  const champion = sorted[0] ?? null;
  const championScore = champion?.score ?? 0;
  for (const experiment of experiments) {
    experiment.verdict =
      champion && experiment.candidate.id === champion.candidate.id
        ? "champion"
        : experiment.score >= Math.max(20, championScore * 0.75)
          ? "promising"
          : "reject";
  }

  const runLabel = `autoresearch-${new Date().toISOString()}`;
  const payload: AutoResearchLabResult = {
    ok: true,
    runLabel,
    mode,
    symbols: cleanSymbols,
    lookbackDays,
    budget: runBudget,
    champion,
    experiments,
    guardrails,
    storedRun: null,
    advisory:
      "AutoResearch automates research pressure-testing. It must never be treated as an automatic buy/sell engine without independent validation and paper-trading evidence.",
  };

  if (databaseConfigured()) {
    payload.storedRun = await insertAutoResearchRun({
      runLabel,
      mode,
      symbols: cleanSymbols,
      budget: runBudget,
      champion: champion as unknown as Record<string, unknown>,
      experiments: experiments as unknown as Array<Record<string, unknown>>,
      guardrails,
    }).catch((error) => ({ error: error instanceof Error ? error.message : "AutoResearch storage failed." }));
  }

  return payload;
}

export async function recentAutoResearchRuns(limit = 10) {
  if (!databaseConfigured()) return [];
  return listAutoResearchRuns(limit);
}

function experimentRisks(metrics: BacktestResult["metrics"]) {
  const risks = [];
  if (metrics.trades < 10) risks.push("Too few historical trades for confidence.");
  if (metrics.maxDrawdownPct > 10) risks.push("Drawdown is high for day-trading promotion.");
  if (metrics.profitFactor < 1) risks.push("Profit factor is below break-even after assumptions.");
  if (metrics.totalReturnPct <= 0) risks.push("Total return did not clear zero in this run.");
  return risks.length ? risks : ["No immediate metric red flag, but still requires out-of-sample paper proof."];
}
