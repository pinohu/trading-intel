import { buildBuyTradeTicket } from "@/lib/tradeTicket";
import type { BuyLead } from "@/lib/signalEngine";

export type IsingCandidate = {
  symbol: string;
  name: string;
  group: string;
  score: number;
  confidence: number;
  rewardRisk: number;
  notional: number;
  riskDollars: number;
  units: number;
  entry: number;
  stop: number;
  target: number;
  tradeable: boolean;
  reasons: string[];
  blockers: string[];
};

export type IsingOptimizerInput = {
  candidates: IsingCandidate[];
  budget: number;
  maxRiskDollars: number;
  maxPositions: number;
  iterations?: number;
  restarts?: number;
  seed?: string;
  overlapPenalty?: number;
};

export type IsingBasketResult = {
  algorithm: "classical-simulated-annealing-qubo";
  selected: IsingCandidate[];
  rejected: Array<IsingCandidate & { rejectReason: string }>;
  objective: number;
  energy: number;
  budgetUsed: number;
  riskUsed: number;
  positions: number;
  constraints: {
    budget: number;
    maxRiskDollars: number;
    maxPositions: number;
  };
  diagnostics: {
    evaluatedCandidates: number;
    iterations: number;
    restarts: number;
    overlapPenalty: number;
    selectedGroups: string[];
    note: string;
  };
};

const defaultIterations = 1200;
const defaultRestarts = 8;

export function buildIsingCandidates({
  buyLeads,
  accountSize,
  riskPct,
  maxDailyLossPct,
}: {
  buyLeads: BuyLead[];
  accountSize: number;
  riskPct: number;
  maxDailyLossPct: number;
}) {
  return buyLeads.slice(0, 12).map((lead) => {
    const ticket = buildBuyTradeTicket({ lead, accountSize, riskPct, maxDailyLossPct });
    const activeBonus = lead.status === "Buy Watch" ? 28 : lead.status === "Buy Lead - Wait for Trigger" ? 10 : -28;
    const warningPenalty = Math.min(24, lead.warnings.length * 5);
    const rewardScore = Math.min(24, Math.max(0, (lead.rewardRisk - 1) * 12));
    const score = clamp(Math.round(lead.confidence * 0.62 + rewardScore + activeBonus - warningPenalty), 0, 100);
    const blockers = [
      lead.status === "No Buy" ? "Not a buy candidate right now." : "",
      !lead.dataFresh ? "Quote is stale." : "",
      ticket.units < 1 ? "Position size is too small for one unit." : "",
      !ticket.tradeable ? "Trade ticket is blocked by risk controls." : "",
      ...lead.warnings.filter((warning) => /stale|outside|sell\/exit|liquidity|execution-grade/i.test(warning)).slice(0, 3),
    ].filter(Boolean);

    return {
      symbol: lead.symbol,
      name: lead.name,
      group: inferRiskGroup(lead.symbol),
      score,
      confidence: lead.confidence,
      rewardRisk: lead.rewardRisk,
      notional: ticket.notional,
      riskDollars: ticket.maxLoss,
      units: ticket.units,
      entry: ticket.entry,
      stop: ticket.stop,
      target: ticket.target,
      tradeable: lead.status !== "No Buy" && lead.dataFresh && ticket.tradeable && score >= 40,
      reasons: [
        `${lead.status}.`,
        `Confidence ${lead.confidence}.`,
        `Reward/risk ${lead.rewardRisk}R.`,
        `Risk group: ${inferRiskGroup(lead.symbol)}.`,
      ],
      blockers,
    } satisfies IsingCandidate;
  });
}

export function optimizeTradeBasketFromLeads({
  buyLeads,
  accountSize,
  riskPct,
  maxDailyLossPct,
  budget = accountSize * 0.35,
  maxRiskDollars = accountSize * (maxDailyLossPct / 100),
  maxPositions = 3,
  seed,
}: {
  buyLeads: BuyLead[];
  accountSize: number;
  riskPct: number;
  maxDailyLossPct: number;
  budget?: number;
  maxRiskDollars?: number;
  maxPositions?: number;
  seed?: string;
}) {
  return optimizeIsingBasket({
    candidates: buildIsingCandidates({ buyLeads, accountSize, riskPct, maxDailyLossPct }),
    budget,
    maxRiskDollars,
    maxPositions,
    seed,
  });
}

export function optimizeIsingBasket(input: IsingOptimizerInput): IsingBasketResult {
  const candidates = input.candidates.slice(0, 16);
  const iterations = Math.max(100, Math.min(input.iterations ?? defaultIterations, 20_000));
  const restarts = Math.max(1, Math.min(input.restarts ?? defaultRestarts, 32));
  const overlapPenalty = input.overlapPenalty ?? 0.34;
  const rng = mulberry32(hashSeed(input.seed ?? candidates.map((candidate) => candidate.symbol).join("|")));
  const constraints = {
    budget: Math.max(1, input.budget),
    maxRiskDollars: Math.max(1, input.maxRiskDollars),
    maxPositions: Math.max(1, Math.min(input.maxPositions, candidates.length || 1)),
  };

  if (candidates.length === 0) {
    return emptyResult(constraints, iterations, restarts, overlapPenalty);
  }

  let bestBits = new Array(candidates.length).fill(0) as number[];
  let bestEnergy = energy(bestBits, candidates, constraints, overlapPenalty);

  for (let restart = 0; restart < restarts; restart += 1) {
    let bits = initialBits(candidates, constraints, rng);
    let currentEnergy = energy(bits, candidates, constraints, overlapPenalty);
    if (currentEnergy < bestEnergy) {
      bestEnergy = currentEnergy;
      bestBits = bits.slice();
    }

    for (let step = 0; step < iterations; step += 1) {
      const temperature = 1.4 * Math.pow(0.015 / 1.4, step / Math.max(1, iterations - 1));
      const index = Math.floor(rng() * candidates.length);
      const proposal = bits.slice();
      proposal[index] = proposal[index] ? 0 : 1;
      const nextEnergy = energy(proposal, candidates, constraints, overlapPenalty);
      const delta = nextEnergy - currentEnergy;
      if (delta <= 0 || Math.exp(-delta / Math.max(temperature, 0.0001)) > rng()) {
        bits = proposal;
        currentEnergy = nextEnergy;
        if (currentEnergy < bestEnergy) {
          bestEnergy = currentEnergy;
          bestBits = bits.slice();
        }
      }
    }
  }

  return buildResult(bestBits, candidates, bestEnergy, constraints, iterations, restarts, overlapPenalty);
}

function energy(
  bits: number[],
  candidates: IsingCandidate[],
  constraints: IsingBasketResult["constraints"],
  overlapPenalty: number,
) {
  let value = 0;
  let budgetUsed = 0;
  let riskUsed = 0;
  let positions = 0;
  let groupOverlap = 0;
  let blockedPenalty = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    if (!bits[index]) continue;
    const candidate = candidates[index];
    value += candidateValue(candidate);
    budgetUsed += candidate.notional;
    riskUsed += candidate.riskDollars;
    positions += 1;
    if (!candidate.tradeable) blockedPenalty += 8;

    for (let inner = index + 1; inner < candidates.length; inner += 1) {
      if (bits[inner] && candidate.group === candidates[inner].group) {
        groupOverlap += overlapPenalty;
      }
    }
  }

  const budgetOver = Math.max(0, budgetUsed - constraints.budget) / constraints.budget;
  const riskOver = Math.max(0, riskUsed - constraints.maxRiskDollars) / constraints.maxRiskDollars;
  const positionOver = Math.max(0, positions - constraints.maxPositions);
  const constraintPenalty = budgetOver * budgetOver * 14 + riskOver * riskOver * 18 + positionOver * positionOver * 3.5;

  return -value + constraintPenalty + groupOverlap + blockedPenalty;
}

function candidateValue(candidate: IsingCandidate) {
  return (
    candidate.score / 38 +
    candidate.confidence / 120 +
    Math.min(candidate.rewardRisk, 4) / 4 -
    Math.min(candidate.blockers.length, 4) * 0.22
  );
}

function initialBits(
  candidates: IsingCandidate[],
  constraints: IsingBasketResult["constraints"],
  rng: () => number,
) {
  const bits = new Array(candidates.length).fill(0) as number[];
  let budget = 0;
  let risk = 0;
  let positions = 0;
  const order = candidates
    .map((candidate, index) => ({ index, score: candidateValue(candidate) + rng() * 0.2 }))
    .sort((a, b) => b.score - a.score);

  for (const item of order) {
    const candidate = candidates[item.index];
    if (!candidate.tradeable) continue;
    if (positions >= constraints.maxPositions) continue;
    if (budget + candidate.notional > constraints.budget) continue;
    if (risk + candidate.riskDollars > constraints.maxRiskDollars) continue;
    bits[item.index] = 1;
    budget += candidate.notional;
    risk += candidate.riskDollars;
    positions += 1;
  }
  return bits;
}

function buildResult(
  bits: number[],
  candidates: IsingCandidate[],
  finalEnergy: number,
  constraints: IsingBasketResult["constraints"],
  iterations: number,
  restarts: number,
  overlapPenalty: number,
) {
  const selected = candidates.filter((_, index) => bits[index]);
  const selectedSymbols = new Set(selected.map((candidate) => candidate.symbol));
  const budgetUsed = round(selected.reduce((sum, candidate) => sum + candidate.notional, 0));
  const riskUsed = round(selected.reduce((sum, candidate) => sum + candidate.riskDollars, 0));
  const selectedGroups = Array.from(new Set(selected.map((candidate) => candidate.group)));
  const rejected = candidates
    .filter((candidate) => !selectedSymbols.has(candidate.symbol))
    .map((candidate) => ({
      ...candidate,
      rejectReason: rejectReason(candidate, selected, constraints),
    }));

  return {
    algorithm: "classical-simulated-annealing-qubo" as const,
    selected,
    rejected,
    objective: round(-finalEnergy),
    energy: round(finalEnergy),
    budgetUsed,
    riskUsed,
    positions: selected.length,
    constraints,
    diagnostics: {
      evaluatedCandidates: candidates.length,
      iterations,
      restarts,
      overlapPenalty,
      selectedGroups,
      note: "Classical simulated annealing over binary Ising/QUBO variables. This optimizes candidate selection; it does not predict prices.",
    },
  } satisfies IsingBasketResult;
}

function rejectReason(
  candidate: IsingCandidate,
  selected: IsingCandidate[],
  constraints: IsingBasketResult["constraints"],
) {
  if (!candidate.tradeable) return candidate.blockers[0] ?? "Trade ticket is not currently tradeable.";
  if (candidate.notional > constraints.budget) return "Uses more budget than the basket allows.";
  if (candidate.riskDollars > constraints.maxRiskDollars) return "Uses more risk than the basket allows.";
  if (selected.length >= constraints.maxPositions) return "Basket is already at the max number of positions.";
  if (selected.some((item) => item.group === candidate.group)) return `Skipped to avoid too much ${candidate.group} overlap.`;
  return "Lower combined score than the selected basket.";
}

function emptyResult(
  constraints: IsingBasketResult["constraints"],
  iterations: number,
  restarts: number,
  overlapPenalty: number,
): IsingBasketResult {
  return {
    algorithm: "classical-simulated-annealing-qubo",
    selected: [],
    rejected: [],
    objective: 0,
    energy: 0,
    budgetUsed: 0,
    riskUsed: 0,
    positions: 0,
    constraints,
    diagnostics: {
      evaluatedCandidates: 0,
      iterations,
      restarts,
      overlapPenalty,
      selectedGroups: [],
      note: "No candidates were available for optimization.",
    },
  };
}

function inferRiskGroup(symbol: string) {
  if (["SPY", "QQQ", "IWM", "DIA"].includes(symbol)) return "index";
  if (["NVDA", "AMD", "AVGO", "SMH"].includes(symbol)) return "semiconductors";
  if (["AAPL", "MSFT", "AMZN", "META", "GOOGL", "GOOG"].includes(symbol)) return "mega-cap tech";
  if (["TSLA", "COIN", "MSTR"].includes(symbol)) return "high-beta growth";
  if (["GLD", "SLV", "GOLD", "SILVER", "COPPER", "CPER"].includes(symbol)) return "metals";
  if (["USO", "UNG", "OIL", "NATGAS", "XLE"].includes(symbol)) return "energy";
  if (["CORN", "WHEAT", "SOY", "DBA"].includes(symbol)) return "agriculture";
  if (["BTCUSD", "ETHUSD"].includes(symbol)) return "crypto";
  return "single-name";
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Number(value.toFixed(2));
}
