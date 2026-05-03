export type TradingMindStance = "buy-watch" | "sell-watch" | "hold" | "risk-off";

export type TradingMindVote = {
  key: string;
  name: string;
  tradition: string;
  stance: TradingMindStance;
  score: number;
  confidence: number;
  principle: string;
  evidence: string[];
  cautions: string[];
  source: string;
};

export type TradingMindConsensus = {
  modelVersion: "trading-minds-v1";
  score: number;
  stance: TradingMindStance;
  alignment: number;
  summary: string;
  buyReasons: string[];
  sellReasons: string[];
  riskRules: string[];
  votes: TradingMindVote[];
};

export type TradingMindInput = {
  symbol: string;
  market: string;
  price: number;
  dayMovePct: number;
  closeLocation: number;
  aboveOpen: boolean;
  aboveVwapProxy: boolean;
  liquid: boolean;
  fresh: boolean;
  inTradingWindow: boolean;
  rewardRisk: number;
  quality?: string;
  rangeEstimated: boolean;
  extended: boolean;
  failedBreakout: boolean;
  severeWeakness: boolean;
  volume: number;
};

type TradingMindProfile = {
  key: string;
  name: string;
  tradition: string;
  source: string;
  principle: string;
  evaluate: (input: TradingMindInput) => Omit<TradingMindVote, "key" | "name" | "tradition" | "source" | "principle">;
};

const profiles: TradingMindProfile[] = [
  {
    key: "buffett-graham",
    name: "Buffett / Graham",
    tradition: "Quality value and margin of safety",
    source: "Berkshire Hathaway shareholder letters",
    principle: "Prefer understandable, durable value with a margin of safety; avoid paying up for fragile enthusiasm.",
    evaluate: (input) => {
      const quality = qualityScore(input);
      const valuationDiscipline = clamp(72 - Math.max(0, input.dayMovePct - 1.2) * 8 - (input.extended ? 22 : 0), 10, 92);
      const score = average([quality, valuationDiscipline, input.fresh ? 70 : 20, input.rewardRisk >= 1.8 ? 72 : 50]);
      return {
        stance: input.extended || input.severeWeakness ? "risk-off" : score >= 70 ? "buy-watch" : score <= 42 ? "sell-watch" : "hold",
        score,
        confidence: input.quality === "Execution Grade" ? 72 : 52,
        evidence: [
          `Data quality/freshness discipline: ${Math.round(quality)}/100`,
          `Chase-risk discipline: ${Math.round(valuationDiscipline)}/100`,
          `Reward/risk: ${input.rewardRisk.toFixed(2)}R`,
        ],
        cautions: [
          input.extended ? "Buffett/Graham lens dislikes paying up after an extended move." : "",
          "This quote-only view cannot prove moat, owner earnings, or intrinsic value.",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "lynch-garp",
    name: "Peter Lynch",
    tradition: "Growth at a reasonable price",
    source: "Fidelity GARP strategy profile",
    principle: "Look for growth with sensible price discipline, not expensive story stocks or cheap value traps.",
    evaluate: (input) => {
      const growthProxy = clamp(50 + input.dayMovePct * 9 + (input.aboveOpen ? 8 : -8) + (input.closeLocation - 0.5) * 40, 5, 94);
      const priceDiscipline = clamp(82 - Math.max(0, input.dayMovePct - 2.2) * 10 - (input.extended ? 18 : 0), 8, 92);
      const score = average([growthProxy, priceDiscipline, input.liquid ? 70 : 42, input.rewardRisk >= 1.5 ? 70 : 35]);
      return {
        stance: input.severeWeakness ? "sell-watch" : score >= 68 ? "buy-watch" : score <= 40 ? "risk-off" : "hold",
        score,
        confidence: 58,
        evidence: [
          `Growth proxy from tape: ${Math.round(growthProxy)}/100`,
          `Reasonable-price proxy: ${Math.round(priceDiscipline)}/100`,
          input.liquid ? "Liquidity supports monitoring." : "Liquidity is below preferred threshold.",
        ],
        cautions: [
          "True Lynch/GARP scoring needs earnings growth, PEG, balance sheet, and business context.",
          input.extended ? "The tape looks expensive to chase without fundamental confirmation." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "oneil-can-slim",
    name: "William O'Neil",
    tradition: "CAN SLIM growth momentum",
    source: "Investor's Business Daily CAN SLIM framework summaries",
    principle: "Favor leading growth stocks with strong demand, strong tape, institutional-style volume, and market direction.",
    evaluate: (input) => {
      const demand = clamp(Math.log10(Math.max(input.volume, 1)) * 11, 20, 92);
      const leadership = clamp(35 + input.dayMovePct * 13 + input.closeLocation * 32 + (input.aboveVwapProxy ? 12 : -8), 1, 98);
      const score = average([demand, leadership, input.fresh ? 78 : 15, input.rewardRisk >= 1.5 ? 72 : 30]);
      return {
        stance: input.fresh && input.inTradingWindow && score >= 72 && !input.extended ? "buy-watch" : input.failedBreakout || input.extended ? "sell-watch" : "hold",
        score,
        confidence: 70,
        evidence: [
          `Demand/volume proxy: ${Math.round(demand)}/100`,
          `Leadership/tape proxy: ${Math.round(leadership)}/100`,
          input.aboveVwapProxy ? "Price is on the stronger side of the session range." : "Price has not reclaimed the stronger side of the range.",
        ],
        cautions: [
          input.extended ? "CAN SLIM-style rules avoid chasing far beyond a proper buy point." : "",
          !input.fresh ? "Fresh market data is required before treating the setup as actionable." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "dennis-eckhardt-turtle",
    name: "Dennis / Eckhardt",
    tradition: "Systematic trend following",
    source: "Original Turtle Trading rules summaries",
    principle: "Trade objective breakouts, predefine exits, size by volatility, and follow rules without discretion.",
    evaluate: (input) => {
      const breakout = clamp(input.closeLocation * 80 + Math.max(0, input.dayMovePct) * 7 + (input.aboveOpen ? 8 : -8), 1, 98);
      const riskControl = clamp(input.rewardRisk * 28 + (input.rangeEstimated ? -12 : 8) + (input.fresh ? 16 : -30), 1, 95);
      const score = average([breakout, riskControl, input.liquid ? 72 : 36]);
      return {
        stance: input.failedBreakout || input.severeWeakness ? "sell-watch" : score >= 70 ? "buy-watch" : score <= 38 ? "risk-off" : "hold",
        score,
        confidence: 74,
        evidence: [
          `Breakout pressure: ${Math.round(breakout)}/100`,
          `Rule-based risk control: ${Math.round(riskControl)}/100`,
          input.rangeEstimated ? "Range is estimated; breakout evidence is weaker." : "Observed range is available.",
        ],
        cautions: [
          "Trend following accepts false breakouts; stop discipline matters more than prediction.",
          input.failedBreakout ? "Failed breakout overrides a long entry." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "livermore-minervini",
    name: "Livermore / Minervini",
    tradition: "Price leadership and cut-loss discipline",
    source: "Common trend-template and tape-reading principles",
    principle: "Buy strength from constructive bases, pyramid only when right, and cut losses quickly when price invalidates.",
    evaluate: (input) => {
      const strength = clamp(30 + input.dayMovePct * 12 + input.closeLocation * 38 + (input.aboveOpen ? 8 : -10), 1, 96);
      const discipline = input.failedBreakout || input.severeWeakness ? 20 : input.rewardRisk >= 1.5 ? 78 : 48;
      const score = average([strength, discipline, input.fresh ? 75 : 18]);
      return {
        stance: input.failedBreakout || input.severeWeakness ? "sell-watch" : score >= 70 ? "buy-watch" : "hold",
        score,
        confidence: 66,
        evidence: [
          `Relative tape strength proxy: ${Math.round(strength)}/100`,
          `Cut-loss discipline proxy: ${Math.round(discipline)}/100`,
        ],
        cautions: [
          input.rewardRisk < 1.5 ? "The setup lacks enough asymmetry for a disciplined momentum entry." : "",
          input.extended ? "Strength exists, but chase risk is high." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "druckenmiller-soros",
    name: "Druckenmiller / Soros",
    tradition: "Asymmetric macro and reflexivity",
    source: "Public macro-trading interviews and risk-management principles",
    principle: "Preserve capital until a high-conviction asymmetric opportunity appears; press only when evidence compounds.",
    evaluate: (input) => {
      const asymmetry = clamp(input.rewardRisk * 30 + Math.max(0, input.dayMovePct) * 6 - (input.extended ? 18 : 0), 1, 95);
      const reflexivity = clamp(45 + input.dayMovePct * 10 + (input.aboveVwapProxy ? 10 : -10) + input.closeLocation * 20, 1, 94);
      const score = average([asymmetry, reflexivity, input.liquid ? 72 : 38]);
      return {
        stance: input.severeWeakness || input.failedBreakout ? "sell-watch" : score >= 74 ? "buy-watch" : score <= 42 ? "risk-off" : "hold",
        score,
        confidence: 60,
        evidence: [
          `Asymmetry proxy: ${Math.round(asymmetry)}/100`,
          `Reflexive tape pressure: ${Math.round(reflexivity)}/100`,
        ],
        cautions: [
          "Macro context is only proxied here; catalyst and regime checks should be reviewed before sizing up.",
          score < 60 ? "Capital preservation beats a low-conviction bet." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "seyota-risk-first",
    name: "Ed Seykota",
    tradition: "Trend following and loss cutting",
    source: "Market Wizards-style trend/risk principles",
    principle: "Follow the trend, cut losses, and keep position sizing small enough to survive being wrong.",
    evaluate: (input) => {
      const trend = clamp(42 + input.dayMovePct * 9 + input.closeLocation * 28 + (input.aboveOpen ? 8 : -8), 1, 94);
      const lossCut = input.severeWeakness || input.failedBreakout ? 18 : input.rewardRisk >= 1.5 ? 76 : 45;
      const score = average([trend, lossCut, input.fresh ? 74 : 18]);
      return {
        stance: input.severeWeakness || input.failedBreakout ? "sell-watch" : score >= 68 ? "buy-watch" : "hold",
        score,
        confidence: 64,
        evidence: [
          `Trend pressure: ${Math.round(trend)}/100`,
          `Loss-cutting gate: ${Math.round(lossCut)}/100`,
        ],
        cautions: [
          "Do not average down against the stop.",
          input.rewardRisk < 1.5 ? "The stop/target shape is not attractive enough." : "",
        ].filter(Boolean),
      };
    },
  },
  {
    key: "dalio-risk-parity",
    name: "Ray Dalio",
    tradition: "Diversification and systematic reality checks",
    source: "Bridgewater and Principles materials",
    principle: "Make decisions explicit, diversify return streams, and respect the risk of being wrong.",
    evaluate: (input) => {
      const reality = average([input.fresh ? 80 : 15, input.quality === "Execution Grade" ? 82 : 58, input.rangeEstimated ? 42 : 74]);
      const concentrationGuard = input.market === "Stock/ETF" ? 64 : 56;
      const score = average([reality, concentrationGuard, input.rewardRisk >= 1.5 ? 70 : 44]);
      return {
        stance: !input.fresh ? "risk-off" : score >= 68 ? "hold" : "risk-off",
        score,
        confidence: 58,
        evidence: [
          `Reality/data check: ${Math.round(reality)}/100`,
          `Single-name concentration guard: ${Math.round(concentrationGuard)}/100`,
        ],
        cautions: [
          "Single-stock picks are not diversified return streams.",
          "Use this as a risk guard, not a standalone buy signal.",
        ],
      };
    },
  },
];

export function evaluateTradingMinds(input: TradingMindInput): TradingMindConsensus {
  const votes = profiles.map((profile) => {
    const vote = profile.evaluate(input);
    return {
      key: profile.key,
      name: profile.name,
      tradition: profile.tradition,
      source: profile.source,
      principle: profile.principle,
      ...vote,
      score: Math.round(clamp(vote.score, 1, 100)),
      confidence: Math.round(clamp(vote.confidence, 1, 100)),
    };
  });
  const buyVotes = votes.filter((vote) => vote.stance === "buy-watch");
  const sellVotes = votes.filter((vote) => vote.stance === "sell-watch" || vote.stance === "risk-off");
  const confidenceWeight = votes.reduce((sum, vote) => sum + vote.confidence / 100, 0) || 1;
  const weightedScore = votes.reduce((sum, vote) => sum + vote.score * (vote.confidence / 100), 0) / confidenceWeight;
  const buyPressure = buyVotes.reduce((sum, vote) => sum + vote.score * (vote.confidence / 100), 0);
  const sellPressure = sellVotes.reduce((sum, vote) => sum + (100 - vote.score) * (vote.confidence / 100), 0);
  const alignment = Math.round((Math.max(buyVotes.length, sellVotes.length) / votes.length) * 100);
  const stance = !input.fresh
    ? "risk-off"
    : sellVotes.length >= 4 && sellPressure > buyPressure
      ? "sell-watch"
      : buyVotes.length >= 3 && buyPressure > sellPressure && weightedScore >= 45
        ? "buy-watch"
        : sellVotes.length >= 3 && weightedScore < 45
          ? "risk-off"
          : "hold";
  const rankedBuy = [...buyVotes].sort((a, b) => b.score - a.score);
  const rankedSell = [...sellVotes].sort((a, b) => a.score - b.score);
  return {
    modelVersion: "trading-minds-v1",
    score: Math.round(clamp(weightedScore, 1, 100)),
    stance,
    alignment,
    summary: summaryFor({ input, stance, buyVotes, sellVotes }),
    buyReasons: rankedBuy.flatMap((vote) => vote.evidence.slice(0, 1)).slice(0, 4),
    sellReasons: rankedSell.flatMap((vote) => [...vote.cautions, ...vote.evidence].slice(0, 1)).slice(0, 4),
    riskRules: riskRulesFor(input, votes),
    votes,
  };
}

function summaryFor({
  input,
  stance,
  buyVotes,
  sellVotes,
}: {
  input: TradingMindInput;
  stance: TradingMindStance;
  buyVotes: TradingMindVote[];
  sellVotes: TradingMindVote[];
}) {
  if (!input.fresh) return "Legendary-strategy panel is risk-off because the quote is stale.";
  if (stance === "buy-watch") return `${buyVotes.length} strategy minds support a buy watch, led by ${buyVotes.map((vote) => vote.name).slice(0, 3).join(", ")}.`;
  if (stance === "sell-watch") return `${sellVotes.length} strategy minds flag sell/avoid risk, led by ${sellVotes.map((vote) => vote.name).slice(0, 3).join(", ")}.`;
  if (stance === "risk-off") return "Strategy minds prefer capital preservation until the setup improves.";
  return "Strategy minds are mixed; keep the symbol on watch and require a cleaner trigger.";
}

function riskRulesFor(input: TradingMindInput, votes: TradingMindVote[]) {
  return [
    "No live action from strategy-mind votes alone; require ticket, stop, target, and broker gates.",
    input.rewardRisk < 1.5 ? "Reject promotion while reward/risk is below 1.5R." : "Keep reward/risk at or above 1.5R.",
    input.extended ? "Do not chase an extended move; wait for a base, pullback, or fresh trigger." : "",
    !input.fresh ? "Stale data blocks all buy/sell promotion." : "",
    votes.some((vote) => vote.key === "dalio-risk-parity") ? "Respect single-name concentration; size smaller than portfolio-level conviction." : "",
  ].filter(Boolean);
}

function qualityScore(input: TradingMindInput) {
  const quality =
    input.quality === "Execution Grade" ? 90 : input.quality === "Public Real-Time" ? 78 : input.quality === "Partial Market" ? 68 : input.quality === "Delayed" ? 42 : 32;
  return average([quality, input.fresh ? 82 : 15, input.rangeEstimated ? 45 : 78]);
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return 50;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
