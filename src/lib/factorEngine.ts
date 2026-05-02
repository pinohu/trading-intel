import type { FundamentalSnapshot } from "@/lib/fundamentals";
import { sectorForSymbol } from "@/lib/sectorIntelligence";
import type { SignalQuote } from "@/lib/signalEngine";

export type FactorScore = {
  name: string;
  score: number;
  weight: number;
  rationale: string[];
};

export type AlgorithmCouncilScore = {
  symbol: string;
  name: string;
  sector: string;
  recommendation: "Strong Buy Watch" | "Buy Watch" | "Hold/No Trade" | "Avoid / Sell Watch";
  ensembleScore: number;
  confidence: number;
  dataCoveragePct: number;
  modelVersion: string;
  factorScores: FactorScore[];
  thesis: string;
  bearCase: string;
  plainAction: string;
  riskControls: string[];
  sources: string[];
  generatedAt: string;
};

export const algorithmCouncilModelVersion = "fundamental-factor-council-v1";

export const algorithmFamilies = [
  {
    key: "fama-french-inspired",
    name: "Fama-French style multi-factor core",
    purpose: "Value, profitability, investment discipline, and size/liquidity-aware ranking.",
  },
  {
    key: "quality-minus-junk",
    name: "Quality-minus-junk style quality screen",
    purpose: "Profitability, margins, cash conversion, leverage, and accounting risk.",
  },
  {
    key: "piotroski",
    name: "Piotroski F-score",
    purpose: "Accounting-strength screen for profitability, balance-sheet improvement, and operating efficiency.",
  },
  {
    key: "beneish-sloan",
    name: "Beneish/Sloan accounting risk",
    purpose: "Detect earnings-manipulation and accrual-quality risk before trusting reported profits.",
  },
  {
    key: "value-momentum-everywhere",
    name: "Value + momentum everywhere",
    purpose: "Blend cheapness with confirmed price strength instead of relying on either alone.",
  },
  {
    key: "risk-first-portfolio",
    name: "Risk-first portfolio construction",
    purpose: "Liquidity, data quality, concentration, and stale-data gates before promotion.",
  },
];

export function scoreAlgorithmCouncil({
  quote,
  fundamentals,
}: {
  quote: SignalQuote;
  fundamentals: FundamentalSnapshot;
}): AlgorithmCouncilScore {
  const factorScores = [
    valueFactor(fundamentals),
    qualityFactor(fundamentals),
    profitabilityFactor(fundamentals),
    investmentFactor(fundamentals),
    momentumFactor(quote),
    accountingRiskFactor(fundamentals),
    dataRiskFactor(quote, fundamentals),
  ];
  const coverage = dataCoverage(fundamentals);
  const weighted = factorScores.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const weight = factorScores.reduce((sum, factor) => sum + factor.weight, 0);
  const raw = weight > 0 ? weighted / weight : 0;
  const riskPenalty = fundamentals.metrics.beneishRisk === "high" ? 12 : fundamentals.metrics.beneishRisk === "elevated" ? 6 : 0;
  const coveragePenalty = coverage < 50 ? 12 : coverage < 70 ? 6 : 0;
  const ensembleScore = clamp(Math.round(raw - riskPenalty - coveragePenalty), 1, 100);
  const confidence = clamp(Math.round(ensembleScore * 0.72 + coverage * 0.28), 1, 100);
  const recommendation = recommendationFor(ensembleScore, confidence, fundamentals, quote);

  return {
    symbol: quote.symbol,
    name: quote.name,
    sector: sectorForSymbol(quote.symbol),
    recommendation,
    ensembleScore,
    confidence,
    dataCoveragePct: coverage,
    modelVersion: algorithmCouncilModelVersion,
    factorScores,
    thesis: thesisFor(recommendation, fundamentals, quote),
    bearCase: bearCaseFor(fundamentals, quote),
    plainAction: plainActionFor(recommendation),
    riskControls: riskControlsFor(fundamentals, quote),
    sources: [
      quote.source,
      fundamentals.source,
      "Fama-French factors",
      "Piotroski F-score",
      "Beneish M-score",
      "Sloan accrual quality",
      "Value + momentum ensemble",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function rankAlgorithmCouncilScores(scores: AlgorithmCouncilScore[]) {
  const recommendationRank = {
    "Strong Buy Watch": 4,
    "Buy Watch": 3,
    "Hold/No Trade": 2,
    "Avoid / Sell Watch": 1,
  };
  return [...scores].sort(
    (a, b) =>
      recommendationRank[b.recommendation] - recommendationRank[a.recommendation] ||
      b.ensembleScore - a.ensembleScore ||
      b.confidence - a.confidence ||
      b.dataCoveragePct - a.dataCoveragePct,
  );
}

function valueFactor(fundamentals: FundamentalSnapshot): FactorScore {
  const metrics = fundamentals.metrics;
  const score = average([
    scoreHigher(metrics.earningsYield, -0.03, 0.12),
    scoreHigher(metrics.salesYield, 0, 1.5),
    scoreHigher(metrics.bookToMarket, 0, 0.8),
    metrics.beneishRisk === "high" ? 20 : null,
  ]);
  return {
    name: "Value",
    score,
    weight: 0.18,
    rationale: [
      explainMetric("Earnings yield", metrics.earningsYield, true),
      explainMetric("Sales yield", metrics.salesYield, true),
      explainMetric("Book-to-market", metrics.bookToMarket, true),
    ],
  };
}

function qualityFactor(fundamentals: FundamentalSnapshot): FactorScore {
  const metrics = fundamentals.metrics;
  const score = average([
    scoreHigher(metrics.piotroskiFScore, 2, 8),
    scoreHigher(metrics.grossMargin, 0.15, 0.7),
    scoreHigher(metrics.fcfMargin, -0.05, 0.25),
    scoreLower(metrics.debtToAssets, 0.85, 0.15),
    scoreLower(abs(metrics.accrualsToAssets), 0.18, 0.02),
  ]);
  return {
    name: "Quality",
    score,
    weight: 0.2,
    rationale: [
      `Piotroski strength: ${metrics.piotroskiFScore ?? "missing"}/9`,
      explainMetric("Gross margin", metrics.grossMargin, true),
      explainMetric("Free-cash-flow margin", metrics.fcfMargin, true),
      explainMetric("Debt/assets", metrics.debtToAssets, false),
    ],
  };
}

function profitabilityFactor(fundamentals: FundamentalSnapshot): FactorScore {
  const metrics = fundamentals.metrics;
  const score = average([
    scoreHigher(metrics.roa, -0.02, 0.18),
    scoreHigher(metrics.operatingMargin, 0, 0.3),
    scoreHigher(metrics.netMargin, -0.05, 0.22),
    scoreHigher(metrics.assetTurnover, 0.1, 1.5),
  ]);
  return {
    name: "Profitability",
    score,
    weight: 0.15,
    rationale: [
      explainMetric("ROA", metrics.roa, true),
      explainMetric("Operating margin", metrics.operatingMargin, true),
      explainMetric("Net margin", metrics.netMargin, true),
    ],
  };
}

function investmentFactor(fundamentals: FundamentalSnapshot): FactorScore {
  const metrics = fundamentals.metrics;
  const score = average([
    scoreLower(metrics.assetGrowth, 0.35, -0.05),
    scoreHigher(metrics.currentRatio, 0.7, 2.5),
    scoreLower(metrics.debtToAssets, 0.8, 0.1),
  ]);
  return {
    name: "Investment Discipline",
    score,
    weight: 0.12,
    rationale: [
      explainMetric("Asset growth", metrics.assetGrowth, false),
      explainMetric("Current ratio", metrics.currentRatio, true),
      explainMetric("Debt/assets", metrics.debtToAssets, false),
    ],
  };
}

function momentumFactor(quote: SignalQuote): FactorScore {
  const range = Math.max(quote.high - quote.low, quote.price * 0.0025);
  const closeLocation = clamp(((quote.price - quote.low) / range) * 100, 0, 100);
  const aboveOpen = quote.price >= quote.open ? 70 : 35;
  const score = average([
    scoreHigher(quote.changePct / 100, -0.02, 0.04),
    closeLocation,
    aboveOpen,
    scoreHigher(Math.log10(Math.max(quote.volume, 1)), 4, 8),
  ]);
  return {
    name: "Momentum / Tape",
    score,
    weight: 0.16,
    rationale: [
      `Move from open/latest reference: ${quote.changePct.toFixed(2)}%`,
      `Close location in current range: ${Math.round(closeLocation)}/100`,
      quote.price >= quote.open ? "Price is holding above the open/reference." : "Price is below the open/reference.",
    ],
  };
}

function accountingRiskFactor(fundamentals: FundamentalSnapshot): FactorScore {
  const metrics = fundamentals.metrics;
  const beneishScore = metrics.beneishRisk === "low" ? 85 : metrics.beneishRisk === "elevated" ? 45 : metrics.beneishRisk === "high" ? 20 : 50;
  const accrualScore = scoreLower(abs(metrics.accrualsToAssets), 0.18, 0.02);
  return {
    name: "Accounting Risk",
    score: average([beneishScore, accrualScore]),
    weight: 0.12,
    rationale: [
      `Beneish risk: ${metrics.beneishRisk}${metrics.beneishMScore !== null ? ` (${metrics.beneishMScore})` : ""}`,
      explainMetric("Accruals/assets", metrics.accrualsToAssets, false),
    ],
  };
}

function dataRiskFactor(quote: SignalQuote, fundamentals: FundamentalSnapshot): FactorScore {
  const ageMs = Date.now() - Date.parse(quote.updatedAt);
  const ageMinutes = Number.isFinite(ageMs) ? ageMs / 60000 : 999;
  const quoteScore = quote.quality === "Execution Grade" ? 95 : quote.quality === "Public Real-Time" ? 82 : quote.quality === "Partial Market" ? 70 : quote.quality === "Delayed" ? 45 : 30;
  const fundamentalScore = fundamentals.dataQuality === "official-sec" ? 90 : fundamentals.dataQuality === "partial-sec" ? 62 : 20;
  return {
    name: "Data Quality / Risk Gate",
    score: average([quoteScore, fundamentalScore, scoreLower(ageMinutes, 90, 1)]),
    weight: 0.07,
    rationale: [
      `Quote quality: ${quote.quality ?? "Unknown"}`,
      `Fundamental quality: ${fundamentals.dataQuality}`,
      `Missing fundamental fields: ${fundamentals.missing.length}`,
    ],
  };
}

function recommendationFor(score: number, confidence: number, fundamentals: FundamentalSnapshot, quote: SignalQuote): AlgorithmCouncilScore["recommendation"] {
  if (fundamentals.metrics.beneishRisk === "high" || score <= 35) return "Avoid / Sell Watch";
  if (score >= 78 && confidence >= 70 && quote.changePct > -2) return "Strong Buy Watch";
  if (score >= 62 && confidence >= 55 && quote.changePct > -4) return "Buy Watch";
  return "Hold/No Trade";
}

function thesisFor(recommendation: AlgorithmCouncilScore["recommendation"], fundamentals: FundamentalSnapshot, quote: SignalQuote) {
  if (recommendation === "Strong Buy Watch") {
    return `${quote.symbol} has strong enough fundamental, accounting, and price-action evidence to deserve top-tier research attention.`;
  }
  if (recommendation === "Buy Watch") {
    return `${quote.symbol} has enough multi-factor support to monitor, but timing and risk gates still matter.`;
  }
  if (recommendation === "Avoid / Sell Watch") {
    return `${quote.symbol} has weak or risky multi-factor evidence, especially around ${fundamentals.metrics.beneishRisk === "high" ? "accounting risk" : "score quality"}.`;
  }
  return `${quote.symbol} does not have enough agreement across the algorithm council for a high-conviction call.`;
}

function bearCaseFor(fundamentals: FundamentalSnapshot, quote: SignalQuote) {
  const issues = [
    fundamentals.metrics.beneishRisk !== "low" ? `Beneish accounting risk is ${fundamentals.metrics.beneishRisk}.` : "",
    fundamentals.metrics.revenueGrowth !== null && fundamentals.metrics.revenueGrowth < 0 ? "Revenue is shrinking." : "",
    fundamentals.metrics.fcfMargin !== null && fundamentals.metrics.fcfMargin < 0 ? "Free cash flow margin is negative." : "",
    quote.changePct < 0 ? "The current tape is red." : "",
    fundamentals.dataQuality !== "official-sec" ? "Fundamental coverage is incomplete." : "",
  ].filter(Boolean);
  return issues[0] ?? "The main bear case is valuation, macro pressure, or a reversal that is not yet visible in the current data.";
}

function plainActionFor(recommendation: AlgorithmCouncilScore["recommendation"]) {
  if (recommendation === "Strong Buy Watch") return "Research this first. It has the best combined fundamental and market evidence right now.";
  if (recommendation === "Buy Watch") return "Keep it on the buy list, but wait for the price trigger and risk ticket.";
  if (recommendation === "Avoid / Sell Watch") return "Do not chase this as a buy. Review risk or avoid until the evidence improves.";
  return "Wait. The evidence is not strong enough yet.";
}

function riskControlsFor(fundamentals: FundamentalSnapshot, quote: SignalQuote) {
  return [
    "Do not promote if the live quote is stale or the price trigger has not fired.",
    fundamentals.dataQuality !== "official-sec" ? "Fundamental data is incomplete; reduce confidence." : "",
    fundamentals.metrics.beneishRisk !== "low" ? "Accounting-risk flag is active; require extra confirmation." : "",
    quote.volume < 1_000_000 ? "Liquidity is below the preferred day-trading threshold." : "",
    "Backtest this factor mix before using real money.",
  ].filter(Boolean);
}

function dataCoverage(fundamentals: FundamentalSnapshot) {
  const metricEntries = Object.entries(fundamentals.metrics).filter(([key]) => key !== "beneishRisk");
  const available = metricEntries.filter(([, value]) => value !== null && value !== "unknown").length;
  return Math.round((available / metricEntries.length) * 100);
}

function explainMetric(label: string, value: number | null, higherBetter: boolean) {
  if (value === null) return `${label}: missing`;
  const suffix = Math.abs(value) <= 3 ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
  return `${label}: ${suffix} (${higherBetter ? "higher helps" : "lower helps"})`;
}

function scoreHigher(value: number | null, low: number, high: number) {
  if (value === null) return null;
  return clamp(((value - low) / (high - low)) * 100, 1, 100);
}

function scoreLower(value: number | null, highBad: number, lowGood: number) {
  if (value === null) return null;
  return clamp(((highBad - value) / (highBad - lowGood)) * 100, 1, 100);
}

function average(values: Array<number | null>) {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (clean.length === 0) return 50;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function abs(value: number | null) {
  return value === null ? null : Math.abs(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
