import type { BacktestSymbolResult } from "@/lib/backtesting";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";
import type { SignalQuote, TradeSignal } from "@/lib/signalEngine";
import type { TradingAgentsDecision, TradingAgentsDepth } from "@/lib/tradingAgents";

export const NATIVE_TRADING_AGENTS_SOURCE = "native-codebase-debate";

type AgentStance = "bullish" | "bearish" | "neutral" | "risk-off";

export type NativeTradingAgentVote = {
  agent: "Market Analyst" | "Fundamentals Analyst" | "Bull Researcher" | "Bear Researcher" | "Trader" | "Risk Manager" | "Portfolio Manager";
  stance: AgentStance;
  confidence: number;
  evidence: string[];
};

export type NativeTradingAgentsDebate = {
  decision: TradingAgentsDecision;
  transcript: NativeTradingAgentVote[];
  consensusScore: number;
};

export function buildNativeTradingAgentsDebate({
  symbol,
  quote,
  signal,
  score,
  backtest,
  depth,
}: {
  symbol: string;
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  depth: TradingAgentsDepth;
}): NativeTradingAgentsDebate {
  const signalBullish = signal?.action === "Buy Watch";
  const signalBearish = signal?.action === "Sell/Exit Watch";
  const scoreBullish = score?.recommendation === "Strong Buy Watch" || score?.recommendation === "Buy Watch";
  const scoreBearish = score?.recommendation === "Avoid / Sell Watch";
  const positiveBacktest = Boolean(backtest && backtest.status === "ok" && backtest.trades >= 3 && backtest.totalReturnPct > 0);
  const robustBacktest = Boolean(positiveBacktest && backtest && backtest.profitFactor >= 1.2 && backtest.maxDrawdownPct <= 12);
  const weakBacktest = Boolean(backtest && (backtest.status !== "ok" || backtest.trades < 3 || backtest.totalReturnPct <= 0));
  const dataConcern = Boolean(!quote || !signal?.dataFresh || quote.quality === "Delayed" || quote.quality === "Unofficial" || quote.quality === "Offline");

  const consensusScore = [
    signalBullish ? 28 : signalBearish ? -26 : 0,
    score?.recommendation === "Strong Buy Watch" ? 28 : scoreBullish ? 20 : scoreBearish ? -28 : 0,
    robustBacktest ? 24 : positiveBacktest ? 16 : weakBacktest ? -14 : 0,
    dataConcern ? -22 : quote?.quality === "Execution Grade" ? 10 : 4,
    score?.confidence ? Math.round((score.confidence - 50) / 4) : 0,
  ].reduce((sum, value) => sum + value, 0);

  const rating =
    dataConcern && consensusScore < 45
      ? "Data Review"
      : signalBearish || scoreBearish
        ? "Risk Review"
        : consensusScore >= 55
          ? "Research Buy Watch"
          : consensusScore >= 25
            ? "Research Watch"
            : "Hold / No Trade";

  const action =
    rating === "Research Buy Watch"
      ? "Prepare paper/watch ticket; manual broker review required"
      : rating === "Research Watch"
        ? "Monitor for stronger confirmation"
        : rating === "Risk Review"
          ? "Avoid or reduce risk until evidence improves"
          : rating === "Data Review"
            ? "Refresh data before any trade decision"
            : "Stand aside";

  const risks = buildRisks({ quote, signal, score, backtest, weakBacktest, dataConcern });
  const holding = holdingPeriodForNativeDecision({ rating, signal, score, robustBacktest, scoreBullish, dataConcern });
  const evidenceSummary = buildEvidenceSummary({ quote, signal, score, backtest, consensusScore });
  const transcript = buildTranscript({
    symbol,
    quote,
    signal,
    score,
    backtest,
    depth,
    rating,
    consensusScore,
    signalBullish,
    signalBearish,
    scoreBullish,
    scoreBearish,
    positiveBacktest,
    robustBacktest,
    weakBacktest,
    dataConcern,
    risks,
  });
  const thesis = buildThesis({ symbol, quote, signal, score, backtest, depth, transcript });

  return {
    decision: {
      symbol,
      rating,
      action,
      holdingPeriod: holding.label,
      expectedHold: holding.expectedHold,
      maxHold: holding.maxHold,
      reviewCadence: holding.reviewCadence,
      exitRule: holding.exitRule,
      evidenceGrade: evidenceGradeFor({ quote, signal, score, dataConcern, robustBacktest, positiveBacktest }),
      evidenceSummary,
      summary: thesis.slice(0, 500),
      thesis,
      risks,
      portfolioDecision: portfolioDecisionFor(rating),
    },
    transcript,
    consensusScore,
  };
}

function buildTranscript({
  symbol,
  quote,
  signal,
  score,
  backtest,
  depth,
  rating,
  consensusScore,
  signalBullish,
  signalBearish,
  scoreBullish,
  scoreBearish,
  positiveBacktest,
  robustBacktest,
  weakBacktest,
  dataConcern,
  risks,
}: {
  symbol: string;
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  depth: TradingAgentsDepth;
  rating: string;
  consensusScore: number;
  signalBullish: boolean;
  signalBearish: boolean;
  scoreBullish: boolean;
  scoreBearish: boolean;
  positiveBacktest: boolean;
  robustBacktest: boolean;
  weakBacktest: boolean;
  dataConcern: boolean;
  risks: string[];
}): NativeTradingAgentVote[] {
  const strongestFactors = [...(score?.factorScores ?? [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, depth === "fast" ? 1 : 3)
    .map((factor) => `${factor.name} ${Math.round(factor.score)}/100`);
  const weakestFactors = [...(score?.factorScores ?? [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, depth === "fast" ? 1 : 3)
    .map((factor) => `${factor.name} ${Math.round(factor.score)}/100`);

  return [
    {
      agent: "Market Analyst",
      stance: signalBullish ? "bullish" : signalBearish ? "bearish" : dataConcern ? "risk-off" : "neutral",
      confidence: signal?.confidence ?? (quote ? 45 : 10),
      evidence: [
        quote ? `${symbol} at ${formatUsd(quote.price)}, ${formatPct(quote.changePct)} day move, ${quote.quality ?? "unknown"} feed from ${quote.source}.` : "No usable quote returned.",
        signal ? `Rule engine says ${signal.action} (${signal.quality}/${signal.confidence}) with ${signal.setup}.` : "No rule signal returned.",
      ],
    },
    {
      agent: "Fundamentals Analyst",
      stance: scoreBullish ? "bullish" : scoreBearish ? "bearish" : "neutral",
      confidence: score?.confidence ?? 35,
      evidence: [
        score ? `Algorithm Council says ${score.recommendation}, ensemble ${score.ensembleScore}, coverage ${score.dataCoveragePct}%.` : "No SEC/factor score returned.",
        strongestFactors.length ? `Strongest factors: ${strongestFactors.join(", ")}.` : "No positive factor cluster available.",
      ],
    },
    {
      agent: "Bull Researcher",
      stance: scoreBullish || signalBullish || positiveBacktest ? "bullish" : "neutral",
      confidence: clamp(45 + (scoreBullish ? 16 : 0) + (signalBullish ? 16 : 0) + (positiveBacktest ? 12 : 0), 1, 100),
      evidence: [
        score?.thesis ?? "No bullish thesis from the factor engine.",
        positiveBacktest && backtest
          ? `Backtest supports the idea: ${backtest.trades} trades, ${backtest.winRate}% win, ${formatPct(backtest.totalReturnPct)} total return, PF ${backtest.profitFactor}.`
          : "Backtest has not confirmed a positive edge yet.",
      ],
    },
    {
      agent: "Bear Researcher",
      stance: scoreBearish || signalBearish || weakBacktest || dataConcern ? "bearish" : "neutral",
      confidence: clamp(45 + (scoreBearish ? 16 : 0) + (signalBearish ? 16 : 0) + (weakBacktest ? 12 : 0) + (dataConcern ? 14 : 0), 1, 100),
      evidence: [
        score?.bearCase ?? "No dedicated bear case returned by the factor engine.",
        weakestFactors.length ? `Weakest factors: ${weakestFactors.join(", ")}.` : "No weak factor cluster available.",
        risks[0] ?? "No major risk item generated.",
      ],
    },
    {
      agent: "Trader",
      stance: rating === "Research Buy Watch" ? "bullish" : rating === "Risk Review" || rating === "Data Review" ? "risk-off" : "neutral",
      confidence: clamp(50 + Math.abs(consensusScore), 1, 100),
      evidence: [
        signal ? `Levels from signal engine: price ${formatUsd(signal.price)}, stop ${formatUsd(signal.invalidation)}, target ${formatUsd(signal.target)}, R/R ${signal.rewardRisk}.` : "No trade levels available.",
        robustBacktest ? "Historical test is strong enough for paper/watch review." : "Historical evidence is not strong enough to skip manual review.",
      ],
    },
    {
      agent: "Risk Manager",
      stance: dataConcern || weakBacktest || risks.length >= 4 ? "risk-off" : "neutral",
      confidence: clamp(55 + risks.length * 6 + (dataConcern ? 14 : 0), 1, 100),
      evidence: risks.slice(0, 4),
    },
    {
      agent: "Portfolio Manager",
      stance: rating === "Research Buy Watch" ? "bullish" : rating === "Risk Review" || rating === "Data Review" ? "risk-off" : "neutral",
      confidence: clamp(55 + Math.abs(consensusScore) / 2, 1, 100),
      evidence: [
        `Consensus score ${consensusScore}; final rating ${rating}.`,
        portfolioDecisionFor(rating),
      ],
    },
  ];
}

function holdingPeriodForNativeDecision({
  rating,
  signal,
  score,
  robustBacktest,
  scoreBullish,
  dataConcern,
}: {
  rating: string;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  robustBacktest: boolean;
  scoreBullish: boolean;
  dataConcern: boolean;
}) {
  if (dataConcern || rating === "Data Review") {
    return {
      label: "No trade / refresh first",
      expectedHold: "No position until market data is fresh enough",
      maxHold: "None",
      reviewCadence: "Refresh data before acting",
      exitRule: "No order while quote quality or freshness is blocked",
    };
  }
  if (rating === "Risk Review" || signal?.action === "Sell/Exit Watch") {
    return {
      label: "Risk-off / same session",
      expectedHold: "Protect or avoid immediately; do not add exposure",
      maxHold: "Same trading session for protection decision",
      reviewCadence: "Review every 5-15 minutes while exposed",
      exitRule: "Reduce or stand aside while sell/exit evidence remains active",
    };
  }
  if (rating === "Research Buy Watch" && signal?.holdingPeriod) {
    return {
      label: signal.holdingPeriod.label,
      expectedHold: robustBacktest ? "Intraday entry with 1-5 trading-day paper validation window" : signal.holdingPeriod.expectedHold,
      maxHold: robustBacktest ? "5 trading days for this tested breakout model; shorter if stop/target hits" : signal.holdingPeriod.maxHold,
      reviewCadence: signal.holdingPeriod.reviewCadence,
      exitRule: signal.holdingPeriod.exitRule,
    };
  }
  if (scoreBullish && score && score.confidence >= 75) {
    return {
      label: "Position research",
      expectedHold: "1-4 weeks while factor thesis and tape remain aligned",
      maxHold: "1 quarter without a refreshed thesis",
      reviewCadence: "Review daily, and after earnings, filings, or major news",
      exitRule: "Exit research watch if factor score deteriorates, bear case triggers, or price action breaks risk controls",
    };
  }
  return {
    label: "Research watch",
    expectedHold: "No immediate position; revisit after stronger evidence",
    maxHold: "Reset after one trading day unless new evidence appears",
    reviewCadence: "Review on each refresh or scheduled research run",
    exitRule: "No order without fresh signal, defined stop, and evidence alignment",
  };
}

function evidenceGradeFor({
  quote,
  signal,
  score,
  dataConcern,
  robustBacktest,
  positiveBacktest,
}: {
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  dataConcern: boolean;
  robustBacktest: boolean;
  positiveBacktest: boolean;
}) {
  if (dataConcern) return "Blocked by data quality";
  const coverage = [
    quote ? 1 : 0,
    signal ? 1 : 0,
    score && score.dataCoveragePct >= 70 ? 1 : 0,
    robustBacktest ? 1 : positiveBacktest ? 0.5 : 0,
  ].reduce((sum, value) => sum + value, 0);
  if (coverage >= 3.5) return "Strong multi-source evidence";
  if (coverage >= 2.5) return "Moderate multi-source evidence";
  return "Thin evidence";
}

function buildEvidenceSummary({
  quote,
  signal,
  score,
  backtest,
  consensusScore,
}: {
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  consensusScore: number;
}) {
  return [
    quote ? `Quote: ${quote.source}, ${quote.quality ?? "unknown"} quality, last ${formatUsd(quote.price)}, ${formatPct(quote.changePct)} move.` : "Quote unavailable.",
    signal ? `Signal: ${signal.action}, ${signal.setup}, ${signal.quality}/${signal.confidence}, hold ${signal.holdingPeriod.expectedHold}.` : "Signal unavailable.",
    score ? `Algorithm Council: ${score.recommendation}, ensemble ${score.ensembleScore}, confidence ${score.confidence}, coverage ${score.dataCoveragePct}%.` : "Algorithm Council unavailable.",
    backtest ? `Backtest: ${backtest.trades} trades, ${backtest.winRate}% win, ${formatPct(backtest.totalReturnPct)} return, ${formatPct(backtest.maxDrawdownPct)} max drawdown, PF ${backtest.profitFactor}.` : "Backtest unavailable.",
    `Native agent consensus score: ${consensusScore}.`,
  ];
}

function buildThesis({
  symbol,
  quote,
  signal,
  score,
  backtest,
  depth,
  transcript,
}: {
  symbol: string;
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  depth: TradingAgentsDepth;
  transcript: NativeTradingAgentVote[];
}) {
  const backtestSummary = backtest
    ? `${backtest.trades} trade(s), ${backtest.winRate}% win rate, ${formatPct(backtest.totalReturnPct)} total return, ${formatPct(backtest.maxDrawdownPct)} max drawdown, profit factor ${backtest.profitFactor}.`
    : "No historical backtest result returned.";
  const agentLines = transcript
    .slice(0, depth === "fast" ? 4 : transcript.length)
    .map((vote) => `${vote.agent}: ${vote.stance} (${Math.round(vote.confidence)} confidence). ${vote.evidence.join(" ")}`);

  return [
    `${symbol} was reviewed by the native in-code TradingAgents debate desk.`,
    quote ? `Market tape: ${formatUsd(quote.price)}, ${formatPct(quote.changePct)} day move, ${quote.quality ?? "unknown"} data quality.` : "Market tape: unavailable.",
    signal ? `Signal engine: ${signal.action}, ${signal.setup}, ${signal.quality}/${signal.confidence}. ${signal.reason}` : "Signal engine: unavailable.",
    score ? `Fundamental/factor council: ${score.recommendation}, ensemble ${score.ensembleScore}, confidence ${score.confidence}. ${score.thesis}` : "Fundamental/factor council: unavailable.",
    `Historical evidence: ${backtestSummary}`,
    ...agentLines,
  ].join(" ");
}

function buildRisks({
  quote,
  signal,
  score,
  backtest,
  weakBacktest,
  dataConcern,
}: {
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  weakBacktest: boolean;
  dataConcern: boolean;
}) {
  const risks = [
    ...(signal?.warnings ?? []),
    ...(score?.riskControls ?? []),
    score?.bearCase,
    weakBacktest && backtest
      ? `Historical sample is weak: ${backtest.trades} trades, ${formatPct(backtest.totalReturnPct)} total return, ${formatPct(backtest.maxDrawdownPct)} max drawdown.`
      : "",
    dataConcern ? `Data quality/freshness is not execution-grade: ${quote?.quality ?? "missing quote"}.` : "",
  ].filter((item): item is string => Boolean(item));

  return risks.length ? risks.slice(0, 8) : ["No major risk note generated, but manual risk review is still required."];
}

function portfolioDecisionFor(rating: string) {
  if (rating === "Research Buy Watch") {
    return "Eligible for paper/watch review. Any live order must be initiated manually through the broker controls with fresh data, acknowledgement, and audit logging.";
  }
  if (rating === "Research Watch") {
    return "Keep on research watch. Wait for stronger signal, factor, or backtest alignment before preparing an order ticket.";
  }
  if (rating === "Risk Review") {
    return "Do not promote while bear-case or sell/avoid evidence is active. Review existing exposure before adding risk.";
  }
  if (rating === "Data Review") {
    return "Refresh or upgrade the data feed before making a trade decision.";
  }
  return "No trade. Preserve capital and wait for higher-quality evidence.";
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
