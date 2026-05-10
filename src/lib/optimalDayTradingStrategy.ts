export type OptimalStrategyName =
  | "VWAP Trend Continuation"
  | "Opening Range Breakout"
  | "Failed Breakout / Reversal"
  | "Catalyst Momentum"
  | "VWAP Mean Reversion"
  | "Support / Resistance Reaction"
  | "Trend Pullback";

export type OptimalStrategyStance = "buy-watch" | "sell-watch" | "wait" | "blocked";

export type OptimalStrategyMatch = {
  name: OptimalStrategyName;
  stance: Exclude<OptimalStrategyStance, "blocked">;
  score: number;
  reason: string;
};

export type OptimalStrategyFit = {
  modelVersion: "optimal-day-trading-v1";
  stance: OptimalStrategyStance;
  score: number;
  alignment: number;
  riskMode: "standard" | "reduced" | "stand-aside";
  matchedSetups: OptimalStrategyMatch[];
  blockers: string[];
  confirmations: string[];
  summary: string;
};

export type OptimalStrategyInput = {
  symbol: string;
  market: "Stock/ETF" | "Commodity ETF" | "Commodity Future" | "Crypto";
  price: number;
  open: number;
  high: number;
  low: number;
  range: number;
  closeLocation: number;
  vwapProxy: number;
  dayMovePct: number;
  changePct: number;
  volume: number;
  liquid: boolean;
  fresh: boolean;
  inTradingWindow: boolean;
  rewardRisk: number;
  hasCatalyst: boolean;
  quality?: string;
  rangeEstimated: boolean;
  extended: boolean;
  failedBreakout: boolean;
  severeWeakness: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value, 1, 100));
}

export function evaluateOptimalDayTradingStrategy(input: OptimalStrategyInput): OptimalStrategyFit {
  const aboveOpen = input.price > input.open;
  const aboveVwap = input.price >= input.vwapProxy;
  const nearHigh = input.closeLocation >= 0.72;
  const nearLow = input.closeLocation <= 0.24;
  const midRange = input.closeLocation > 0.32 && input.closeLocation < 0.68;
  const rangePct = (input.range / Math.max(input.price, 1)) * 100;
  const distanceFromVwapPct = ((input.price - input.vwapProxy) / Math.max(input.vwapProxy, 1)) * 100;
  const priorHighBreak = input.price >= input.high - Math.max(input.range * 0.12, input.price * 0.001);
  const supportReaction = input.price > input.low + input.range * 0.22 && input.closeLocation >= 0.45;
  const pullbackHeld = aboveVwap && aboveOpen && midRange && input.dayMovePct > 0.15;
  const matches: OptimalStrategyMatch[] = [];

  if (aboveVwap && aboveOpen && nearHigh && input.dayMovePct >= 0.45 && input.liquid) {
    matches.push({
      name: "VWAP Trend Continuation",
      stance: "buy-watch",
      score: roundScore(58 + input.closeLocation * 22 + Math.min(12, input.dayMovePct * 4)),
      reason: "Price is above open, above the VWAP proxy, and holding the strong side of the intraday range.",
    });
  }

  if (priorHighBreak && input.dayMovePct >= 0.8 && input.liquid && aboveOpen) {
    matches.push({
      name: "Opening Range Breakout",
      stance: "buy-watch",
      score: roundScore(56 + input.closeLocation * 24 + Math.min(14, input.dayMovePct * 5)),
      reason: "Price is pressing the high of day with positive intraday momentum and adequate liquidity.",
    });
  }

  if (input.failedBreakout || (input.dayMovePct > 0.25 && input.closeLocation < 0.42)) {
    matches.push({
      name: "Failed Breakout / Reversal",
      stance: "sell-watch",
      score: roundScore(62 + (0.5 - input.closeLocation) * 42),
      reason: "A positive move is failing to hold the upper range, which can trap late breakout buyers.",
    });
  }

  if (input.hasCatalyst && aboveVwap && input.dayMovePct >= 0.5 && input.liquid && !input.extended) {
    matches.push({
      name: "Catalyst Momentum",
      stance: "buy-watch",
      score: roundScore(60 + input.closeLocation * 18 + Math.min(12, input.dayMovePct * 4)),
      reason: "Fresh catalyst context plus strong tape can support a momentum watch.",
    });
  }

  if (Math.abs(distanceFromVwapPct) >= Math.max(0.8, rangePct * 0.35) && (nearLow || input.extended)) {
    matches.push({
      name: "VWAP Mean Reversion",
      stance: input.extended ? "sell-watch" : "wait",
      score: roundScore(54 + Math.min(30, Math.abs(distanceFromVwapPct) * 7)),
      reason: input.extended
        ? "Price is stretched far from the VWAP proxy; chase risk is elevated."
        : "Price is stretched and weak; wait for a clean reversal confirmation before considering a bounce.",
    });
  }

  if (supportReaction && input.rewardRisk >= 1.5 && input.liquid && !input.severeWeakness) {
    matches.push({
      name: "Support / Resistance Reaction",
      stance: "buy-watch",
      score: roundScore(52 + input.closeLocation * 18 + Math.min(16, input.rewardRisk * 6)),
      reason: "Price is reacting away from support with acceptable reward/risk.",
    });
  }

  if (pullbackHeld && input.rewardRisk >= 1.5 && !input.extended) {
    matches.push({
      name: "Trend Pullback",
      stance: "buy-watch",
      score: roundScore(58 + input.closeLocation * 12 + Math.min(18, input.rewardRisk * 6)),
      reason: "The trend is positive and the pullback is still holding the stronger side of the session.",
    });
  }

  const blockers = [
    !input.fresh ? "Quote is stale; no strategy can promote." : "",
    !input.inTradingWindow ? "Outside the clean regular-session window; wait for confirmation." : "",
    !input.liquid ? "Liquidity is below the preferred day-trading threshold." : "",
    input.rewardRisk < 1.5 ? `Reward/risk is ${input.rewardRisk.toFixed(2)}R; minimum preferred promotion is 1.5R.` : "",
    input.rangeEstimated ? "Range is estimated from limited public quote fields." : "",
    input.extended ? "Move is extended; avoid chasing without a reset or pullback." : "",
    input.severeWeakness ? "Intraday tape is too weak for a long setup." : "",
    input.quality && input.quality !== "Execution Grade" ? `Feed is ${input.quality}, not licensed execution-grade.` : "",
  ].filter(Boolean);

  const buyMatches = matches.filter((match) => match.stance === "buy-watch");
  const sellMatches = matches.filter((match) => match.stance === "sell-watch");
  const waitMatches = matches.filter((match) => match.stance === "wait");
  const averageBuy = buyMatches.length ? buyMatches.reduce((sum, match) => sum + match.score, 0) / buyMatches.length : 0;
  const averageSell = sellMatches.length ? sellMatches.reduce((sum, match) => sum + match.score, 0) / sellMatches.length : 0;
  const blockerPenalty = blockers.reduce((sum, blocker) => {
    if (/stale|liquidity|reward\/risk|weak/i.test(blocker)) return sum + 18;
    if (/outside|extended/i.test(blocker)) return sum + 12;
    return sum + 5;
  }, 0);
  const baseScore = Math.max(averageBuy, averageSell, waitMatches[0]?.score ?? 38);
  const score = roundScore(baseScore + buyMatches.length * 5 - sellMatches.length * 4 - blockerPenalty);
  const alignment = Math.round((Math.max(buyMatches.length, sellMatches.length, waitMatches.length) / 7) * 100);
  const hardBlocked = blockers.some((blocker) => /stale|liquidity|reward\/risk|weak/i.test(blocker));
  const stance: OptimalStrategyStance =
    hardBlocked
      ? "blocked"
      : sellMatches.length >= 1 && averageSell >= averageBuy - 5
        ? "sell-watch"
        : buyMatches.length >= 2 && score >= 58
          ? "buy-watch"
          : "wait";
  const riskMode =
    stance === "blocked" || stance === "sell-watch"
      ? "stand-aside"
      : blockers.some((blocker) => /outside|estimated|extended|not licensed/i.test(blocker)) || input.market !== "Stock/ETF"
        ? "reduced"
        : "standard";
  const confirmations = [
    buyMatches.length ? `${buyMatches.length} long setup(s) agree: ${buyMatches.map((match) => match.name).join(", ")}.` : "",
    sellMatches.length ? `${sellMatches.length} risk/exit setup(s) active: ${sellMatches.map((match) => match.name).join(", ")}.` : "",
    input.rewardRisk >= 1.5 ? `Reward/risk passes at ${input.rewardRisk.toFixed(2)}R.` : "",
    input.fresh ? "Freshness gate passed." : "",
    input.liquid ? "Liquidity gate passed." : "",
  ].filter(Boolean);
  const summary =
    stance === "buy-watch"
      ? `Composite strategy is buy-watch: ${buyMatches.map((match) => match.name).slice(0, 3).join(", ")} align.`
      : stance === "sell-watch"
        ? `Composite strategy is risk-off/sell-watch: ${sellMatches.map((match) => match.name).join(", ")}.`
        : stance === "blocked"
          ? `Composite strategy blocks promotion: ${blockers.slice(0, 2).join(" ")}`
          : waitMatches.length
            ? `Composite strategy says wait: ${waitMatches.map((match) => match.name).join(", ")} needs confirmation.`
            : "Composite strategy sees no A+ day-trading setup yet.";

  return {
    modelVersion: "optimal-day-trading-v1",
    stance,
    score,
    alignment,
    riskMode,
    matchedSetups: matches.sort((a, b) => b.score - a.score),
    blockers,
    confirmations,
    summary,
  };
}
