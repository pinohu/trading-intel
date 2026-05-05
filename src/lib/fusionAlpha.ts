import { engineCapabilities, type EngineCapability } from "@/lib/engineCatalog";
import type { BacktestSymbolResult } from "@/lib/backtesting";
import type { BuyNowSignal, BlockedBuyNowSignal } from "@/lib/buyNowEngine";
import type { AlgorithmCouncilScore } from "@/lib/factorEngine";
import type { BuyLead, SignalQuote, TradeSignal } from "@/lib/signalEngine";
import type { TradingAgentsDecision } from "@/lib/tradingAgents";

export const fusionAlphaModelVersion = "fusion-alpha-v1";

export type FusionAlphaAction =
  | "Strong Buy / Paper Candidate"
  | "Buy Watch"
  | "Hold / No Trade"
  | "Reduce / Avoid Adds"
  | "Sell / Avoid"
  | "Data Review";

export type FusionFindingStatus = "active" | "proxy" | "blocked" | "not-applicable";
export type FusionStance = "bullish" | "bearish" | "neutral" | "risk-off" | "blocked";

export type FusionEngineFinding = {
  key: string;
  label: string;
  repo: string;
  lane: string;
  status: FusionFindingStatus;
  stance: FusionStance;
  score: number;
  weight: number;
  impact: "supports" | "challenges" | "guards" | "neutral";
  finding: string;
  evidence: string[];
};

export type FusionAlgorithmFinding = {
  key: string;
  name: string;
  stance: FusionStance;
  score: number;
  weight: number;
  finding: string;
};

export type FusionPrediction = {
  symbol: string;
  name: string;
  action: FusionAlphaAction;
  score: number;
  confidence: number;
  priority: number;
  direction: "buy" | "sell" | "hold" | "review";
  horizon: string;
  expectedHold: string;
  maxHold: string;
  reviewCadence: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rewardRisk: number | null;
  forecast: {
    units: number;
    notional: number;
    expectedMovePct: number;
    projectedPnl: number;
    maxLoss: number;
    label: string;
  };
  thesis: string;
  operatorAction: string;
  conflicts: string[];
  blockers: string[];
  engineFindings: FusionEngineFinding[];
  algorithmFindings: FusionAlgorithmFinding[];
  topSupports: FusionEngineFinding[];
  topChallenges: FusionEngineFinding[];
};

export type FusionAlphaResult = {
  ok: boolean;
  source: "fusion-alpha-v1";
  modelVersion: string;
  generatedAt: string;
  predictions: FusionPrediction[];
  advisory: string;
  error?: string;
};

export type FusionResearchComponent = {
  key: string;
  label: string;
  ready: boolean;
  mode: string;
  category: string;
};

export type FusionNewsItem = {
  symbol: string;
  title: string;
  source?: string;
  publishedAt?: string;
};

export function buildFusionAlphaPredictions({
  quotes,
  signals,
  buyLeads,
  buyNow,
  blockedBuyNow,
  algorithmScores,
  backtestResults,
  tradingAgents,
  researchComponents = [],
  newsItems = [],
  brokerReady = false,
  accountSize = 10000,
  riskPct = 1,
  maxDailyLossPct = 3,
}: {
  quotes: SignalQuote[];
  signals: TradeSignal[];
  buyLeads: BuyLead[];
  buyNow: BuyNowSignal[];
  blockedBuyNow?: BlockedBuyNowSignal[];
  algorithmScores?: AlgorithmCouncilScore[];
  backtestResults?: BacktestSymbolResult[];
  tradingAgents?: TradingAgentsDecision[];
  researchComponents?: FusionResearchComponent[];
  newsItems?: FusionNewsItem[];
  brokerReady?: boolean;
  accountSize?: number;
  riskPct?: number;
  maxDailyLossPct?: number;
}) {
  const signalBySymbol = bySymbol(signals);
  const leadBySymbol = bySymbol(buyLeads);
  const buyNowBySymbol = bySymbol(buyNow);
  const blockedBySymbol = bySymbol(blockedBuyNow ?? []);
  const scoreBySymbol = bySymbol(algorithmScores ?? []);
  const backtestBySymbol = bySymbol(backtestResults ?? []);
  const agentBySymbol = bySymbol(tradingAgents ?? []);
  const componentsByKey = new Map(researchComponents.map((component) => [component.key, component]));

  return quotes
    .map((quote) => {
      const signal = signalBySymbol.get(quote.symbol);
      const lead = leadBySymbol.get(quote.symbol);
      const activeBuy = buyNowBySymbol.get(quote.symbol);
      const blockedBuy = blockedBySymbol.get(quote.symbol);
      const score = scoreBySymbol.get(quote.symbol);
      const backtest = backtestBySymbol.get(quote.symbol);
      const agent = agentBySymbol.get(quote.symbol);
      const symbolNews = newsItems.filter((item) => item.symbol === quote.symbol);
      const algorithmFindings = buildAlgorithmFindings(score, signal);
      const engineFindings = engineCapabilities.map((engine) =>
        buildEngineFinding({
          engine,
          quote,
          signal,
          activeBuy,
          score,
          backtest,
          agent,
          componentsByKey,
          symbolNews,
          brokerReady,
          algorithmFindings,
        }),
      );
      const allWeighted = [...engineFindings, ...algorithmFindings];
      const finalScore = weightedScore(allWeighted);
      const conflicts = conflictList({ signal, score, backtest, agent, engineFindings });
      const blockers = blockerList({ signal, blockedBuy, agent, backtest });
      const confidence = fusionConfidence({ finalScore, engineFindings, algorithmFindings, conflicts });
      const action = fusionAction({ finalScore, confidence, signal, activeBuy, agent });
      const direction = directionForAction(action);
      const horizon = horizonFor({ activeBuy, lead, signal, agent });
      const topSupports = engineFindings.filter((finding) => finding.impact === "supports").sort((a, b) => b.score - a.score).slice(0, 4);
      const topChallenges = engineFindings.filter((finding) => finding.impact === "challenges" || finding.impact === "guards").sort((a, b) => a.score - b.score).slice(0, 4);
      const orderShape = orderShapeFor({ activeBuy, lead, signal });
      const forecast = forecastFor({ direction, orderShape, activeBuy, accountSize, riskPct, maxDailyLossPct });

      return {
        symbol: quote.symbol,
        name: quote.name,
        action,
        score: finalScore,
        confidence,
        priority: Math.round(finalScore * (confidence / 100)),
        direction,
        ...horizon,
        ...orderShape,
        forecast,
        thesis: thesisFor({ quote, action, finalScore, confidence, topSupports, topChallenges, score, backtest, agent }),
        operatorAction: operatorActionFor({ action, activeBuy, lead, signal, blockers }),
        conflicts,
        blockers,
        engineFindings,
        algorithmFindings,
        topSupports,
        topChallenges,
      } satisfies FusionPrediction;
    })
    .sort((a, b) => b.priority - a.priority || b.score - a.score || b.confidence - a.confidence);
}

function buildEngineFinding({
  engine,
  quote,
  signal,
  activeBuy,
  score,
  backtest,
  agent,
  componentsByKey,
  symbolNews,
  brokerReady,
  algorithmFindings,
}: {
  engine: EngineCapability;
  quote: SignalQuote;
  signal?: TradeSignal;
  activeBuy?: BuyNowSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  componentsByKey: Map<string, FusionResearchComponent>;
  symbolNews: FusionNewsItem[];
  brokerReady: boolean;
  algorithmFindings: FusionAlgorithmFinding[];
}): FusionEngineFinding {
  const key = engineKey(engine);
  const component = componentsByKey.get(key);
  const status: FusionFindingStatus = component?.ready ? "active" : "proxy";
  const base = {
    key,
    label: engine.productName,
    repo: engine.repo,
    lane: engine.lane,
    weight: engineWeight(key),
  };

  if (key === "openbb") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([qualityScore(quote), coverage]);
    return finding({
      ...base,
      status,
      score: value,
      finding: `${component?.ready ? "OpenBB lane" : "OpenBB-style proxy"} grades data breadth at ${Math.round(coverage)}/100 before trusting the tape.`,
      evidence: [`Quote source: ${quote.source}`, `Quote quality: ${quote.quality}`, `Fundamental coverage: ${score?.dataCoveragePct ?? "proxy"}`],
    });
  }

  if (key === "alphavantage") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([qualityScore(quote), coverage, signal?.dataFresh ? 72 : 28, score?.ensembleScore ?? 50]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Alpha Vantage worker can enrich free-account time series, fundamentals, technical indicators, FX, crypto, and provider warning context."
        : "Alpha Vantage lane is proxy-only until a self-hosted worker supplies rate-limit-labeled provider evidence.",
      evidence: [
        `Quote source: ${quote.source}`,
        `Quote quality: ${quote.quality}`,
        `Data coverage: ${Math.round(coverage)}/100`,
        signal?.dataFresh ? "Fresh signal features available." : "Fresh signal features missing.",
      ],
    });
  }

  if (key === "alphalens") {
    const value = average([
      score?.ensembleScore ?? 50,
      score?.confidence ?? 50,
      score?.dataCoveragePct ?? qualityScore(quote),
      signalScore(signal),
      vectorRobustnessScore(backtest),
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Alphalens worker can pressure-test factor ranks with forward returns, IC, turnover, grouped analysis, and quantile spreads."
        : "Alphalens lane is proxy-only until a self-hosted worker returns factor tear-sheet evidence.",
      evidence: [
        score ? `Factor ensemble: ${score.ensembleScore}/100 at ${score.confidence}/100 confidence.` : "Factor ensemble unavailable.",
        validationEvidence(backtest),
        signal?.dataFresh ? "Fresh signal features available." : "Fresh signal features missing.",
      ],
    });
  }

  if (key === "systematic-reference-map") {
    const value = average([
      qualityScore(quote),
      signal?.dataFresh ? 78 : 20,
      score ? score.confidence : 42,
      backtest ? vectorRobustnessScore(backtest) : 38,
      agent ? agentScore(agent) : 44,
      activeBuy || signal?.rewardRisk ? clamp((activeBuy?.rewardRisk ?? signal?.rewardRisk ?? 1) * 28, 28, 86) : 46,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Systematic Trading Reference Map checks whether this idea has data, alpha, analytics, backtest, live-control, architecture, tooling, and AI challenge coverage before it scores as decision-ready."
        : "Systematic Trading Reference Map is proxy-only until the native readiness checklist is loaded.",
      evidence: [
        `Quote source: ${quote.source}; quality ${quote.quality}.`,
        ...pipelineEvidence({ signal, score, backtest, agent, activeBuy }),
      ],
    });
  }

  if (key === "openstock") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([qualityScore(quote), coverage, signal?.dataFresh ? 68 : 32, agent ? agentScore(agent) : 50]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "OpenStock companion lane can cross-check market-app search, watchlist, company-insight, news, and alert context."
        : "OpenStock lane is proxy-only until a self-hosted companion worker supplies labeled market-app context.",
      evidence: [
        `Quote source: ${quote.source}`,
        `Quote quality: ${quote.quality}`,
        signal?.dataFresh ? "Fresh dashboard signal exists." : "Fresh dashboard signal missing.",
      ],
    });
  }

  if (key === "stocksight") {
    const sentiment = sentimentScore(symbolNews);
    const sourceBreadth = clamp(28 + symbolNews.length * 14 + (component?.ready ? 12 : 0), 20, 88);
    const value = average([sentiment.score, sourceBreadth, signalScore(signal), score?.ensembleScore ?? 50, signal?.dataFresh ? 72 : 24]);
    return finding({
      ...base,
      status: component?.ready ? "active" : symbolNews.length ? "proxy" : status,
      score: value,
      finding: component?.ready
        ? `StockSight worker can mine Twitter/news sentiment and label catalyst tone as ${sentiment.label}.`
        : symbolNews.length
          ? `StockSight lane is proxy-only; current headline text reads as ${sentiment.label}.`
          : "StockSight lane is neutral until a self-hosted worker or current headline set supplies sentiment evidence.",
      evidence: [
        `Sentiment source count: ${symbolNews.length}`,
        signal?.dataFresh ? "Fresh signal can be challenged by catalyst sentiment." : "Fresh signal missing; sentiment cannot promote action.",
        ...(symbolNews.length ? symbolNews.slice(0, 2).map((item) => `${item.source ?? "news"}: ${item.title}`) : ["No current headline evidence loaded for this symbol."]),
      ],
    });
  }

  if (key === "streetmerchant") {
    const value = average([
      signal?.dataFresh ? 76 : 24,
      activeBuy ? 72 : signal?.action === "Buy Watch" || signal?.action === "Sell/Exit Watch" ? 62 : 45,
      signal?.confidence ?? 50,
      component?.ready ? 70 : 46,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "StreetMerchant-style alert worker can pressure-test watch loops, channel fanout, cooldowns, and manual-action guardrails."
        : "StreetMerchant lane is proxy-only; it contributes alert-operations discipline, not equity quote data or trade authorization.",
      evidence: [
        signal?.dataFresh ? "Fresh signal can drive alert state." : "Fresh signal is missing; alert should not fire.",
        activeBuy ? "Actionable ticket candidate exists." : "No actionable ticket candidate.",
        "StreetMerchant monitors retail inventory stock; this app uses only its alert-loop pattern.",
      ],
    });
  }

  if (key === "ghostfolio") {
    const exposureScore = average([
      activeBuy ? 68 : 48,
      brokerReady ? 64 : 42,
      signal?.action === "Buy Watch" ? 62 : signal?.action === "Sell/Exit Watch" ? 35 : 50,
      signal?.rewardRisk ? clamp(signal.rewardRisk * 28, 30, 82) : 50,
    ]);
    return finding({
      ...base,
      status,
      score: exposureScore,
      finding: component?.ready
        ? "Ghostfolio companion lane can cross-check portfolio performance, allocation, holdings concentration, transactions, and static risk context."
        : "Ghostfolio lane is proxy-only until a self-hosted portfolio worker supplies account-level analytics.",
      evidence: [
        activeBuy ? "Trade ticket candidate exists." : "No trade ticket candidate.",
        brokerReady ? "Broker/portfolio route is available." : "Broker/portfolio route is locked.",
        signal?.rewardRisk ? `Reward/risk: ${signal.rewardRisk}R` : "Reward/risk unavailable.",
      ],
    });
  }

  if (key === "akshare") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([qualityScore(quote), coverage, signal?.dataFresh ? 70 : 30]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "AKShare worker can enrich non-US market, macro, futures, bond, option, fund, and reference-data research."
        : "AKShare lane is proxy-only until a self-hosted worker supplies labeled research data.",
      evidence: [`Quote source: ${quote.source}`, `Quote quality: ${quote.quality}`, `Data coverage: ${Math.round(coverage)}/100`],
    });
  }

  if (key === "tradingagents") {
    const value = agent ? agentScore(agent) : agreementProxyScore({ signal, score, backtest });
    return finding({
      ...base,
      status: agent ? "active" : "proxy",
      score: value,
      finding: agent
        ? `TradingAgents says ${agent.rating}: ${agent.action}.`
        : "TradingAgents debate has not been run for this dashboard state; proxy uses signal/factor/backtest agreement.",
      evidence: agent ? [agent.expectedHold, agent.evidenceGrade, ...agent.risks.slice(0, 1)] : proxyEvidence({ signal, score, backtest }),
    });
  }

  if (key === "stockpredictionai") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([
      signalScore(signal),
      vectorRobustnessScore(backtest),
      coverage,
      agent ? agentScore(agent) : 50,
      signal?.dataFresh ? 72 : 28,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "StockPredictionAI forecast worker is available for GAN/LSTM/CNN research pressure and feature diagnostics."
        : "StockPredictionAI forecast lane is proxy-only until a self-hosted worker returns holdout-tested forecasts.",
      evidence: [
        `Data coverage: ${Math.round(coverage)}/100`,
        validationEvidence(backtest),
        signal?.dataFresh ? "Fresh signal features available." : "Fresh signal features missing.",
      ],
    });
  }

  if (key === "lstmtimeseries") {
    const coverage = score?.dataCoveragePct ?? qualityScore(quote);
    const value = average([
      signalScore(signal),
      vectorRobustnessScore(backtest),
      backtestScore(backtest),
      coverage,
      signal?.dataFresh ? 70 : 24,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "LSTM Time Series worker is available for sequence-window forecasts, walk-forward holdouts, and stale-dependency warnings."
        : "LSTM Time Series lane is proxy-only until a self-hosted worker returns holdout-tested sequence forecasts and baseline comparisons.",
      evidence: [
        `Data coverage: ${Math.round(coverage)}/100`,
        validationEvidence(backtest),
        backtestStatus(backtest),
      ],
    });
  }

  if (key === "llmtradinglab") {
    const value = average([
      agent ? agentScore(agent) : agreementProxyScore({ signal, score, backtest }),
      signalScore(signal),
      activeBuy ? 66 : 44,
      signal?.rewardRisk ? clamp(signal.rewardRisk * 30, 30, 86) : 50,
      brokerReady ? 60 : 42,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "LLM Trading Lab worker is available for forward-only LLM decision logs, hard constraints, stop-loss compliance, and benchmark comparison."
        : "LLM Trading Lab lane is proxy-only until a self-hosted worker returns auditable decision and portfolio logs.",
      evidence: [
        agent ? `Agent decision: ${agent.rating}` : "Native agent decision not available.",
        activeBuy ? "Trade ticket candidate exists." : "No trade ticket candidate.",
        signal?.rewardRisk ? `Reward/risk: ${signal.rewardRisk}R` : "Reward/risk unavailable.",
      ],
    });
  }

  if (key === "stockpredictionmodels") {
    const value = average([
      signalScore(signal),
      backtestScore(backtest),
      vectorRobustnessScore(backtest),
      agent ? agentScore(agent) : 50,
      signal?.dataFresh ? 70 : 25,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Stock Prediction Models worker is available for ML/DL model-zoo comparison, simulations, stacking, and RL-agent research."
        : "Stock Prediction Models lane is proxy-only until a self-hosted worker returns holdout-tested model comparisons.",
      evidence: [
        backtestStatus(backtest),
        validationEvidence(backtest),
        signal?.dataFresh ? "Fresh feature set available." : "Fresh feature set missing.",
      ],
    });
  }

  if (key === "lean") {
    const value = leanGateScore(backtest, signal);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "LEAN worker can supply event-driven backtests, optimizer-style sweeps, fill models, and multi-asset promotion evidence."
        : backtest
          ? `LEAN-style promotion gate reviews ${backtest.trades} historical trade(s), ${pct(backtest.totalReturnPct)} return, ${pct(backtest.maxDrawdownPct)} max drawdown.`
          : "LEAN-style promotion gate is neutral until historical bars or an external LEAN worker supplies proof.",
      evidence: [
        backtestStatus(backtest),
        validationEvidence(backtest),
        signal ? `Signal: ${signal.action}` : "Signal unavailable",
        "LEAN worker output cannot place live orders through this app.",
      ],
    });
  }

  if (key === "stocksharp") {
    const value = average([eventSimulationScore(backtest, activeBuy), brokerReady ? 68 : 44, signal?.dataFresh ? 72 : 36]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "StockSharp C# worker is available for connector research, strategy simulation, and broker-adapter cross-checks."
        : "StockSharp C# worker is not connected; Fusion uses a proxy score from native backtests, broker readiness, and signal freshness.",
      evidence: [
        backtestStatus(backtest),
        brokerReady ? "Broker readiness gate is available." : "Broker readiness gate is locked.",
        activeBuy ? "Buy-now ticket exists." : "No executable buy-now ticket.",
      ],
    });
  }

  if (key === "rqalpha") {
    const value = average([
      eventSimulationScore(backtest, activeBuy),
      vectorRobustnessScore(backtest),
      signal?.rewardRisk ? clamp(signal.rewardRisk * 26, 28, 84) : 50,
      signal?.dataFresh ? 70 : 30,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "RQAlpha worker is available for event-driven simulation, Mod risk checks, analyser metrics, and transaction-cost pressure."
        : "RQAlpha lane is proxy-only until a self-hosted worker returns simulated order, holding, portfolio, risk, and transaction-cost evidence.",
      evidence: [
        backtestStatus(backtest),
        validationEvidence(backtest),
        signal?.rewardRisk ? `Reward/risk: ${signal.rewardRisk}R` : "Reward/risk unavailable.",
      ],
    });
  }

  if (key === "backtesting-py") {
    const value = backtestScore(backtest);
    return finding({
      ...base,
      status: backtest ? "active" : "proxy",
      score: value,
      finding: backtest
        ? `Native backtest.py lane scores the breakout model with PF ${backtest.profitFactor}, ${pct(backtest.totalReturnPct)} return.`
        : "Native backtest.py lane waits for a real historical run; current score is neutral.",
      evidence: [backtestStatus(backtest)],
    });
  }

  if (key === "vectorbt") {
    const value = vectorRobustnessScore(backtest);
    return finding({
      ...base,
      status: backtest ? "proxy" : status,
      score: value,
      finding: backtest
        ? "vectorbt-style robustness checks the walk-forward validation and punishes fragile out-of-sample behavior."
        : "vectorbt-style parameter sweep is neutral until validation data exists.",
      evidence: [validationEvidence(backtest)],
    });
  }

  if (key === "backtrader") {
    const value = eventSimulationScore(backtest, activeBuy);
    return finding({
      ...base,
      status: backtest ? "proxy" : status,
      score: value,
      finding: "Backtrader-style simulation checks whether order logic, trade count, and drawdown are realistic enough to mirror.",
      evidence: [backtestStatus(backtest), activeBuy ? "Buy-now ticket exists." : "No executable buy-now ticket."],
    });
  }

  if (key === "nautilus") {
    const value = nautilusExecutionScore({ signal, activeBuy, brokerReady });
    return finding({
      ...base,
      status: brokerReady ? "proxy" : "blocked",
      score: value,
      finding: brokerReady
        ? "Nautilus-style production rail allows paper execution only after freshness, ticket, and control gates align."
        : "Nautilus-style production rail blocks execution while broker/pre-trade readiness is unavailable.",
      evidence: [signal?.dataFresh ? "Fresh data gate passed." : "Fresh data gate blocked.", activeBuy ? "Order candidate exists." : "No order candidate."],
    });
  }

  if (key === "finrl") {
    const value = reinforcementPolicyScore({ signal, score, backtest, agent, algorithmFindings });
    return finding({
      ...base,
      status,
      score: value,
      finding: "FinRL-style policy layer rewards multi-engine agreement and penalizes unstable or contradictory setups.",
      evidence: agreementEvidence({ signal, score, backtest, agent }),
    });
  }

  if (key === "finrl-trading") {
    const value = pipelineScore({ signal, score, backtest, agent, activeBuy });
    return finding({
      ...base,
      status,
      score: value,
      finding: "FinRL-Trading pipeline checks whether data, features, model vote, risk ticket, and execution stage are all present.",
      evidence: pipelineEvidence({ signal, score, backtest, agent, activeBuy }),
    });
  }

  if (key === "fingpt") {
    const sentiment = sentimentScore(symbolNews);
    return finding({
      ...base,
      status: symbolNews.length ? "proxy" : status,
      score: sentiment.score,
      finding: symbolNews.length
        ? `FinGPT-style catalyst desk reads ${symbolNews.length} headline(s) as ${sentiment.label}.`
        : "FinGPT-style catalyst desk is neutral because no current headline evidence is loaded for this symbol.",
      evidence: symbolNews.slice(0, 3).map((item) => `${item.source ?? "news"}: ${item.title}`),
    });
  }

  if (key === "jesse") {
    if (!isCryptoSymbol(quote.symbol)) {
      return finding({
        ...base,
        status: "not-applicable",
        score: 50,
        weight: 0.01,
        finding: "Jesse crypto lane is intentionally separated from stock/ETF predictions.",
        evidence: ["Non-crypto symbol."],
      });
    }
    const value = average([qualityScore(quote), signal ? signal.confidence : 50]);
    return finding({
      ...base,
      status,
      score: value,
      finding: "Jesse-style crypto lane applies exchange-aware separation before any crypto paper workflow.",
      evidence: [`Crypto symbol: ${quote.symbol}`, signal ? `Signal: ${signal.action}` : "Signal unavailable"],
    });
  }

  if (key === "freqtrade") {
    if (!isCryptoSymbol(quote.symbol)) {
      return finding({
        ...base,
        status: "not-applicable",
        score: 50,
        weight: 0.01,
        finding: "Freqtrade crypto strategy lane is intentionally separated from stock/ETF predictions.",
        evidence: ["Non-crypto symbol."],
      });
    }
    const value = average([
      qualityScore(quote),
      backtestScore(backtest),
      vectorRobustnessScore(backtest),
      signal?.dataFresh ? 72 : 24,
      activeBuy ? 68 : signal?.action === "Buy Watch" ? 58 : 44,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Freqtrade worker can pressure-test crypto setups with dry-run, backtest, strategy, and hyperopt-style evidence."
        : "Freqtrade lane is proxy-only until a self-hosted crypto worker returns dry-run/backtest evidence.",
      evidence: [
        `Crypto symbol: ${quote.symbol}`,
        backtestStatus(backtest),
        validationEvidence(backtest),
        activeBuy ? "Paper ticket candidate exists." : "No paper ticket candidate.",
      ],
    });
  }

  if (key === "hummingbot") {
    if (!isCryptoSymbol(quote.symbol)) {
      return finding({
        ...base,
        status: "not-applicable",
        score: 50,
        weight: 0.01,
        finding: "Hummingbot liquidity lane is intentionally separated from stock/ETF predictions.",
        evidence: ["Non-crypto symbol."],
      });
    }
    const value = average([
      qualityScore(quote),
      signal?.dataFresh ? 72 : 24,
      backtestScore(backtest),
      vectorRobustnessScore(backtest),
      activeBuy ? 62 : signal?.action === "Buy Watch" ? 55 : 48,
    ]);
    return finding({
      ...base,
      status,
      score: value,
      finding: component?.ready
        ? "Hummingbot worker can pressure-test crypto liquidity setups with connector readiness, dry-run market-making, inventory skew, spread, fee, and venue evidence."
        : "Hummingbot lane is proxy-only until a self-hosted liquidity worker returns connector and dry-run evidence.",
      evidence: [
        `Crypto symbol: ${quote.symbol}`,
        backtestStatus(backtest),
        validationEvidence(backtest),
        signal?.dataFresh ? "Fresh crypto signal available." : "Fresh crypto signal missing.",
        "Hummingbot worker output cannot place live exchange orders through this app.",
      ],
    });
  }

  if (key === "vibe-trading") {
    const value = swarmStrategyScore({ quote, signal, score, backtest, agent, algorithmFindings });
    return finding({
      ...base,
      status,
      score: value,
      finding: "Vibe-Trading-style strategy swarm checks whether natural-language thesis, cross-market data, validation, and optimizer pressure point in the same direction.",
      evidence: [
        `Data breadth: ${Math.round(qualityScore(quote))}/100`,
        signal ? `Rule feature: ${signal.action} ${signal.quality}/${signal.confidence}` : "Rule feature missing.",
        backtest ? `Validation feature: ${backtest.trades} trade(s), ${pct(backtest.totalReturnPct)} return.` : "Validation feature missing.",
      ],
    });
  }

  if (key === "ai-trader") {
    const value = collectiveSignalScore({ signal, score, backtest, agent, activeBuy });
    return finding({
      ...base,
      status,
      score: value,
      finding: "AI-Trader-style collective desk treats the setup as an agent-signal network and punishes disagreement before paper mirroring.",
      evidence: agreementEvidence({ signal, score, backtest, agent }),
    });
  }

  if (key === "polymarket-agents") {
    const sentiment = sentimentScore(symbolNews);
    const value = predictionMarketScore({ sentiment: sentiment.score, signal, score, agent });
    return finding({
      ...base,
      status: symbolNews.length ? "proxy" : status,
      score: value,
      finding: "Polymarket-agent style RAG/event desk asks whether the trade depends on a catalyst whose probability is still uncertain.",
      evidence: symbolNews.length ? symbolNews.slice(0, 3).map((item) => `${item.source ?? "news"}: ${item.title}`) : ["No event/news RAG evidence loaded for this symbol."],
    });
  }

  if (key === "tensortrade") {
    const value = tensorTradeRewardScore({ signal, score, backtest, activeBuy });
    return finding({
      ...base,
      status,
      score: value,
      finding: "TensorTrade-style RL lab converts the idea into state, action, reward, and risk feedback before it can score as tradable.",
      evidence: [
        signal ? `State/action: ${signal.action}, reward/risk ${signal.rewardRisk}R.` : "State/action unavailable.",
        backtest ? `Reward history: ${pct(backtest.totalReturnPct)} return, ${pct(backtest.maxDrawdownPct)} drawdown.` : "Reward history unavailable.",
        activeBuy ? "Action is currently executable as a paper candidate." : "Action is not executable yet.",
      ],
    });
  }

  if (key === "tradingagents-cn") {
    const value = dataConsensusScore({ quote, signal, score });
    return finding({
      ...base,
      status,
      score: value,
      finding: "TradingAgents-CN-style data consensus rewards source fallback, synchronized quotes, and clean reportable evidence before analysis.",
      evidence: [`Quote source: ${quote.source}`, `Quote quality: ${quote.quality}`, `Coverage: ${score?.dataCoveragePct ?? "proxy"}/100`],
    });
  }

  if (key === "openalice") {
    const value = lifecycleGuardScore({ signal, activeBuy, agent, brokerReady });
    return finding({
      ...base,
      status: brokerReady ? "proxy" : "blocked",
      score: value,
      finding: "OpenAlice-style lifecycle gate scores staged order quality, versioned approval, guard checks, and exit-management cadence.",
      evidence: [
        activeBuy ? "Staged paper order candidate exists." : "No staged order candidate.",
        agent ? `Management cadence: ${agent.reviewCadence}` : signal?.holdingPeriod.reviewCadence ?? "No management cadence.",
        brokerReady ? "Broker/control rail is ready." : "Broker/control rail is not ready.",
      ],
    });
  }

  if (key === "quantdinger") {
    const value = quantOpsScore({ signal, score, backtest, agent, activeBuy, brokerReady });
    return finding({
      ...base,
      status,
      score: value,
      finding: "QuantDinger-style quant ops checks whether research, strategy evidence, alerts, execution readiness, and operations continuity exist in one workflow.",
      evidence: pipelineEvidence({ signal, score, backtest, agent, activeBuy }),
    });
  }

  if (key === "autohedge") {
    const value = autoHedgeRiskScore({ signal, score, backtest, activeBuy, brokerReady });
    return finding({
      ...base,
      status,
      score: value,
      finding: "AutoHedge-style swarm stages Director, Quant, Risk, and Execution votes; risk can veto even when alpha looks attractive.",
      evidence: [
        score ? `Director thesis score: ${score.ensembleScore}/100.` : "Director thesis unavailable.",
        backtest ? `Quant evidence: PF ${backtest.profitFactor}, drawdown ${pct(backtest.maxDrawdownPct)}.` : "Quant evidence unavailable.",
        activeBuy ? `Risk ticket: ${activeBuy.rewardRisk}R, max loss ${money(activeBuy.maxLoss)}.` : "Risk ticket unavailable.",
      ],
    });
  }

  return finding({
    ...base,
    status,
    score: agreementProxyScore({ signal, score, backtest }),
    finding: `${engine.productName} contributes a neutralized research proxy until its full worker is connected.`,
    evidence: proxyEvidence({ signal, score, backtest }),
  });
}

function buildAlgorithmFindings(score: AlgorithmCouncilScore | undefined, signal: TradeSignal | undefined): FusionAlgorithmFinding[] {
  return [
    algorithmFinding("fama-french-inspired", "Fama-French style multi-factor core", averageFactor(score, ["Value", "Profitability", "Investment Discipline"])),
    algorithmFinding("quality-minus-junk", "Quality-minus-junk style quality screen", averageFactor(score, ["Quality", "Accounting Risk"])),
    algorithmFinding("piotroski", "Piotroski F-score", averageFactor(score, ["Quality", "Profitability"])),
    algorithmFinding("beneish-sloan", "Beneish/Sloan accounting risk", averageFactor(score, ["Accounting Risk"])),
    algorithmFinding("value-momentum-everywhere", "Value + momentum everywhere", average([averageFactor(score, ["Value"]), averageFactor(score, ["Momentum / Tape"], signalScore(signal))])),
    algorithmFinding("legendary-strategy-minds", "Legendary strategy minds", signal?.strategyMindset.score ?? 50),
    algorithmFinding("risk-first-portfolio", "Risk-first portfolio construction", average([averageFactor(score, ["Data Quality / Risk Gate"], signal?.dataFresh ? 75 : 25), signal?.rewardRisk ? clamp(signal.rewardRisk * 30, 20, 90) : 50])),
  ];
}

function algorithmFinding(key: string, name: string, score: number): FusionAlgorithmFinding {
  return {
    key,
    name,
    score: Math.round(score),
    stance: stanceFor(score),
    weight: 0.045,
    finding: `${name} contributes ${Math.round(score)}/100 to the fusion vote.`,
  };
}

function finding(input: Omit<FusionEngineFinding, "stance" | "impact">): FusionEngineFinding {
  const stance = input.status === "blocked" ? "blocked" : stanceFor(input.score);
  return {
    ...input,
    score: Math.round(clamp(input.score, 0, 100)),
    stance,
    impact: impactFor(input.score, input.status),
  };
}

function engineKey(engine: EngineCapability) {
  if (engine.repo.includes("OpenBB")) return "openbb";
  if (engine.repo.includes("alpha_vantage")) return "alphavantage";
  if (engine.repo.includes("alphalens")) return "alphalens";
  if (engine.repo.includes("awesome-systematic-trading")) return "systematic-reference-map";
  if (engine.repo.includes("OpenStock")) return "openstock";
  if (engine.repo.includes("stocksight")) return "stocksight";
  if (engine.repo.includes("streetmerchant")) return "streetmerchant";
  if (engine.repo.includes("ghostfolio")) return "ghostfolio";
  if (engine.repo.includes("akshare")) return "akshare";
  if (engine.repo.includes("TradingAgents-CN")) return "tradingagents-cn";
  if (engine.repo.includes("TradingAgents")) return "tradingagents";
  if (engine.repo.includes("stockpredictionai")) return "stockpredictionai";
  if (engine.repo.includes("LSTM-Neural-Network")) return "lstmtimeseries";
  if (engine.repo.includes("LLM-Trading-Lab")) return "llmtradinglab";
  if (engine.repo.includes("Stock-Prediction-Models")) return "stockpredictionmodels";
  if (engine.repo.includes("Lean")) return "lean";
  if (engine.repo.includes("StockSharp")) return "stocksharp";
  if (engine.repo.includes("rqalpha")) return "rqalpha";
  if (engine.repo.includes("backtesting.py")) return "backtesting-py";
  if (engine.repo.includes("vectorbt")) return "vectorbt";
  if (engine.repo.includes("backtrader")) return "backtrader";
  if (engine.repo.includes("nautilus")) return "nautilus";
  if (engine.repo.endsWith("/FinRL")) return "finrl";
  if (engine.repo.includes("FinRL-Trading")) return "finrl-trading";
  if (engine.repo.includes("FinGPT")) return "fingpt";
  if (engine.repo.includes("freqtrade")) return "freqtrade";
  if (engine.repo.includes("hummingbot")) return "hummingbot";
  if (engine.repo.includes("jesse")) return "jesse";
  if (engine.repo.includes("Vibe-Trading")) return "vibe-trading";
  if (engine.repo.includes("AI-Trader")) return "ai-trader";
  if (engine.repo.includes("Polymarket/agents")) return "polymarket-agents";
  if (engine.repo.includes("tensortrade")) return "tensortrade";
  if (engine.repo.includes("OpenAlice")) return "openalice";
  if (engine.repo.includes("QuantDinger")) return "quantdinger";
  if (engine.repo.includes("AutoHedge")) return "autohedge";
  return engine.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function engineWeight(key: string) {
  const weights: Record<string, number> = {
    openbb: 0.075,
    alphavantage: 0.06,
    alphalens: 0.075,
    "systematic-reference-map": 0.05,
    openstock: 0.055,
    stocksight: 0.055,
    streetmerchant: 0.045,
    ghostfolio: 0.07,
    akshare: 0.06,
    tradingagents: 0.13,
    stockpredictionai: 0.065,
    lstmtimeseries: 0.055,
    llmtradinglab: 0.075,
    stockpredictionmodels: 0.06,
    lean: 0.095,
    stocksharp: 0.075,
    rqalpha: 0.07,
    "backtesting-py": 0.105,
    vectorbt: 0.085,
    backtrader: 0.065,
    nautilus: 0.06,
    finrl: 0.075,
    "finrl-trading": 0.06,
    fingpt: 0.07,
    freqtrade: 0.055,
    hummingbot: 0.05,
    jesse: 0.035,
    "vibe-trading": 0.075,
    "ai-trader": 0.06,
    "polymarket-agents": 0.045,
    tensortrade: 0.06,
    "tradingagents-cn": 0.055,
    openalice: 0.065,
    quantdinger: 0.06,
    autohedge: 0.065,
  };
  return weights[key] ?? 0.04;
}

function qualityScore(quote: SignalQuote) {
  const quality = quote.quality;
  const ageMs = Date.now() - Date.parse(quote.updatedAt);
  const ageMinutes = Number.isFinite(ageMs) ? ageMs / 60000 : 999;
  const qualityValue =
    quality === "Execution Grade" ? 96 : quality === "Public Real-Time" ? 84 : quality === "Partial Market" ? 72 : quality === "Delayed" ? 42 : quality === "Offline" ? 18 : 55;
  return average([qualityValue, scoreLower(ageMinutes, 120, 1)]);
}

function signalScore(signal: TradeSignal | undefined) {
  if (!signal) return 50;
  if (!signal.dataFresh) return 18;
  if (signal.action === "Buy Watch") return clamp(55 + signal.confidence * 0.42 + Math.max(0, signal.rewardRisk - 1) * 8, 1, 98);
  if (signal.action === "Sell/Exit Watch") return clamp(45 - signal.confidence * 0.42, 1, 50);
  return clamp(45 + (signal.confidence - 50) * 0.08, 30, 62);
}

function agentScore(agent: TradingAgentsDecision) {
  const text = `${agent.rating} ${agent.action}`.toLowerCase();
  if (text.includes("data review")) return 18;
  if (text.includes("risk") || text.includes("sell") || text.includes("avoid")) return 28;
  if (text.includes("strong") || text.includes("buy")) return agent.evidenceGrade.toLowerCase().includes("strong") ? 86 : 74;
  return 52;
}

function backtestScore(backtest: BacktestSymbolResult | undefined) {
  if (!backtest) return 50;
  if (backtest.status !== "ok") return 35;
  if (backtest.trades === 0) return 45;
  return clamp(50 + backtest.totalReturnPct * 1.4 + (backtest.winRate - 50) * 0.45 + (backtest.profitFactor - 1) * 12 - backtest.maxDrawdownPct * 0.8, 5, 95);
}

function leanGateScore(backtest: BacktestSymbolResult | undefined, signal: TradeSignal | undefined) {
  if (!backtest) return signal?.action === "Buy Watch" ? 56 : 50;
  const robust = backtest.status === "ok" && backtest.trades >= 3 && backtest.totalReturnPct > 0 && backtest.profitFactor >= 1.2 && backtest.maxDrawdownPct <= 12;
  if (robust) return 78;
  return backtestScore(backtest) - (signal?.action === "Buy Watch" ? 0 : 4);
}

function vectorRobustnessScore(backtest: BacktestSymbolResult | undefined) {
  const validation = validationRecord(backtest);
  if (!backtest || !validation) return backtestScore(backtest);
  const robustness = numberField(validation, "robustness");
  const outOfSample = recordField(validation, "outOfSample");
  const outReturn = numberField(outOfSample, "totalReturnPct");
  const outTrades = numberField(outOfSample, "trades");
  return clamp(50 + robustness * 1.25 + outReturn * 1.1 + Math.min(outTrades, 10) * 1.4 - backtest.maxDrawdownPct * 0.7, 5, 95);
}

function eventSimulationScore(backtest: BacktestSymbolResult | undefined, activeBuy: BuyNowSignal | undefined) {
  const base = backtestScore(backtest);
  const tradeCount = Math.min(backtest?.trades ?? 0, 12);
  return clamp(base + tradeCount * 0.9 + (activeBuy ? 6 : -4), 5, 95);
}

function nautilusExecutionScore({ signal, activeBuy, brokerReady }: { signal?: TradeSignal; activeBuy?: BuyNowSignal; brokerReady: boolean }) {
  if (!brokerReady) return 25;
  if (!signal?.dataFresh) return 20;
  if (activeBuy) return 82;
  if (signal.action === "Buy Watch") return 68;
  if (signal.action === "Sell/Exit Watch") return 28;
  return 52;
}

function swarmStrategyScore({
  quote,
  signal,
  score,
  backtest,
  agent,
  algorithmFindings,
}: {
  quote: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  algorithmFindings: FusionAlgorithmFinding[];
}) {
  const breadth = [signal, score, backtest, agent].filter(Boolean).length * 5;
  return clamp(average([qualityScore(quote), signalScore(signal), score?.ensembleScore ?? 50, backtestScore(backtest), agent ? agentScore(agent) : 50, average(algorithmFindings.map((item) => item.score))]) + breadth, 5, 95);
}

function collectiveSignalScore({
  signal,
  score,
  backtest,
  agent,
  activeBuy,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  activeBuy?: BuyNowSignal;
}) {
  const votes = [signalScore(signal), score?.confidence ?? 50, backtestScore(backtest), agent ? agentScore(agent) : 50];
  const spread = Math.max(...votes) - Math.min(...votes);
  return clamp(average(votes) + (activeBuy ? 7 : 0) - Math.max(0, spread - 30) * 0.45, 5, 95);
}

function predictionMarketScore({
  sentiment,
  signal,
  score,
  agent,
}: {
  sentiment: number;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  agent?: TradingAgentsDecision;
}) {
  const dataBlock = !signal?.dataFresh || agent?.rating === "Data Review";
  const eventUncertaintyPenalty = Math.abs(sentiment - 50) < 8 ? 4 : 0;
  return clamp(average([sentiment, signalScore(signal), score?.ensembleScore ?? 50, agent ? agentScore(agent) : 50]) - eventUncertaintyPenalty - (dataBlock ? 16 : 0), 5, 95);
}

function tensorTradeRewardScore({
  signal,
  score,
  backtest,
  activeBuy,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  activeBuy?: BuyNowSignal;
}) {
  const reward = activeBuy?.rewardRisk ?? signal?.rewardRisk ?? 1;
  const rewardScore = clamp(40 + reward * 18, 5, 95);
  const drawdownPenalty = backtest ? Math.min(25, backtest.maxDrawdownPct * 1.1) : 0;
  return clamp(average([signalScore(signal), score?.ensembleScore ?? 50, backtestScore(backtest), rewardScore]) - drawdownPenalty * 0.35, 5, 95);
}

function dataConsensusScore({
  quote,
  signal,
  score,
}: {
  quote: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
}) {
  const sourceScore = quote.source.toLowerCase().includes("fallback") ? 54 : quote.source.toLowerCase().includes("alpaca") ? 82 : 70;
  return clamp(average([qualityScore(quote), sourceScore, score?.dataCoveragePct ?? 50, signal?.dataFresh ? 82 : 18]), 5, 95);
}

function lifecycleGuardScore({
  signal,
  activeBuy,
  agent,
  brokerReady,
}: {
  signal?: TradeSignal;
  activeBuy?: BuyNowSignal;
  agent?: TradingAgentsDecision;
  brokerReady: boolean;
}) {
  if (!brokerReady) return 28;
  const management = agent?.reviewCadence || signal?.holdingPeriod.reviewCadence ? 72 : 45;
  const order = activeBuy ? 82 : signal?.action === "Buy Watch" ? 64 : signal?.action === "Sell/Exit Watch" ? 34 : 50;
  return clamp(average([signalScore(signal), management, order]) + (agent ? 5 : 0), 5, 95);
}

function quantOpsScore({
  signal,
  score,
  backtest,
  agent,
  activeBuy,
  brokerReady,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  activeBuy?: BuyNowSignal;
  brokerReady: boolean;
}) {
  const present = [signal, score, backtest, agent, activeBuy].filter(Boolean).length;
  const ops = brokerReady ? 72 : 42;
  return clamp(average([pipelineScore({ signal, score, backtest, agent, activeBuy }), ops]) + present * 2, 5, 95);
}

function autoHedgeRiskScore({
  signal,
  score,
  backtest,
  activeBuy,
  brokerReady,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  activeBuy?: BuyNowSignal;
  brokerReady: boolean;
}) {
  const director = score?.ensembleScore ?? 50;
  const quant = backtestScore(backtest);
  const risk =
    activeBuy && activeBuy.rewardRisk >= 1.5
      ? 76
      : signal?.rewardRisk && signal.rewardRisk >= 1.5
        ? 66
        : signal?.action === "Sell/Exit Watch"
          ? 28
          : 48;
  const execution = brokerReady && activeBuy ? 78 : brokerReady ? 58 : 35;
  return clamp(average([director, quant, risk, execution, signalScore(signal)]), 5, 95);
}

function reinforcementPolicyScore({
  signal,
  score,
  backtest,
  agent,
  algorithmFindings,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  algorithmFindings: FusionAlgorithmFinding[];
}) {
  const votes = [
    signalScore(signal),
    score?.ensembleScore ?? 50,
    backtestScore(backtest),
    agent ? agentScore(agent) : 50,
    average(algorithmFindings.map((item) => item.score)),
  ];
  const spread = Math.max(...votes) - Math.min(...votes);
  return clamp(average(votes) - Math.max(0, spread - 35) * 0.4, 5, 95);
}

function pipelineScore({
  signal,
  score,
  backtest,
  agent,
  activeBuy,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  activeBuy?: BuyNowSignal;
}) {
  const present = [signal, score, backtest, agent, activeBuy].filter(Boolean).length;
  const quality = average([signalScore(signal), score?.confidence ?? 50, backtestScore(backtest), agent ? agentScore(agent) : 50]);
  return clamp(quality * 0.75 + present * 5, 5, 95);
}

function sentimentScore(news: FusionNewsItem[]) {
  if (!news.length) return { score: 50, label: "neutral" };
  const positiveWords = ["beat", "growth", "upgrade", "surge", "record", "profit", "strong", "raise", "approval", "contract"];
  const negativeWords = ["miss", "downgrade", "fall", "probe", "loss", "weak", "cut", "lawsuit", "delay", "warning"];
  const joined = news.map((item) => item.title.toLowerCase()).join(" ");
  const positive = positiveWords.reduce((sum, word) => sum + countWord(joined, word), 0);
  const negative = negativeWords.reduce((sum, word) => sum + countWord(joined, word), 0);
  const raw = clamp(50 + positive * 7 - negative * 8, 10, 90);
  return { score: raw, label: raw >= 60 ? "constructive" : raw <= 40 ? "risk-off" : "mixed" };
}

function agreementProxyScore({
  signal,
  score,
  backtest,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
}) {
  return average([signalScore(signal), score?.ensembleScore ?? 50, backtestScore(backtest)]);
}

function weightedScore(items: Array<{ score: number; weight: number; status?: FusionFindingStatus }>) {
  const active = items.filter((item) => item.status !== "not-applicable");
  const weight = active.reduce((sum, item) => sum + item.weight, 0);
  if (weight <= 0) return 50;
  return Math.round(clamp(active.reduce((sum, item) => sum + item.score * item.weight, 0) / weight, 0, 100));
}

function fusionConfidence({
  finalScore,
  engineFindings,
  algorithmFindings,
  conflicts,
}: {
  finalScore: number;
  engineFindings: FusionEngineFinding[];
  algorithmFindings: FusionAlgorithmFinding[];
  conflicts: string[];
}) {
  const findings = [...engineFindings, ...algorithmFindings];
  const activeWeight = engineFindings.filter((item) => item.status === "active" || item.status === "proxy").reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = engineFindings.filter((item) => item.status !== "not-applicable").reduce((sum, item) => sum + item.weight, 0) || 1;
  const bullish = findings.filter((item) => item.stance === "bullish").length;
  const bearish = findings.filter((item) => item.stance === "bearish" || item.stance === "risk-off").length;
  const neutral = findings.length - bullish - bearish;
  const agreement = Math.max(bullish, bearish, neutral) / Math.max(1, findings.length);
  return Math.round(clamp(35 + (activeWeight / totalWeight) * 24 + agreement * 24 + Math.abs(finalScore - 50) * 0.35 - conflicts.length * 4, 1, 99));
}

function fusionAction({
  finalScore,
  confidence,
  signal,
  activeBuy,
  agent,
}: {
  finalScore: number;
  confidence: number;
  signal?: TradeSignal;
  activeBuy?: BuyNowSignal;
  agent?: TradingAgentsDecision;
}): FusionAlphaAction {
  if (!signal?.dataFresh || agent?.rating === "Data Review") return "Data Review";
  if (finalScore >= 78 && confidence >= 68 && activeBuy) return "Strong Buy / Paper Candidate";
  if (finalScore >= 65) return "Buy Watch";
  if (finalScore <= 34) return "Sell / Avoid";
  if (finalScore <= 44) return "Reduce / Avoid Adds";
  return "Hold / No Trade";
}

function directionForAction(action: FusionAlphaAction): FusionPrediction["direction"] {
  if (action.includes("Buy")) return "buy";
  if (action.includes("Sell") || action.includes("Reduce")) return "sell";
  if (action === "Data Review") return "review";
  return "hold";
}

function horizonFor({
  activeBuy,
  lead,
  signal,
  agent,
}: {
  activeBuy?: BuyNowSignal;
  lead?: BuyLead;
  signal?: TradeSignal;
  agent?: TradingAgentsDecision;
}) {
  return {
    horizon: agent?.holdingPeriod ?? activeBuy?.holdingPeriod ?? lead?.holdingPeriod.label ?? signal?.holdingPeriod.label ?? "Research watch",
    expectedHold: agent?.expectedHold ?? activeBuy?.expectedHold ?? lead?.holdingPeriod.expectedHold ?? signal?.holdingPeriod.expectedHold ?? "Review before entry",
    maxHold: agent?.maxHold ?? activeBuy?.maxHold ?? lead?.holdingPeriod.maxHold ?? signal?.holdingPeriod.maxHold ?? "Reset after one trading day without fresh evidence",
    reviewCadence: agent?.reviewCadence ?? activeBuy?.reviewCadence ?? lead?.holdingPeriod.reviewCadence ?? signal?.holdingPeriod.reviewCadence ?? "Review on each refresh",
  };
}

function orderShapeFor({
  activeBuy,
  lead,
  signal,
}: {
  activeBuy?: BuyNowSignal;
  lead?: BuyLead;
  signal?: TradeSignal;
}) {
  return {
    entry: activeBuy?.entry ?? lead?.trigger ?? signal?.price ?? null,
    stop: activeBuy?.stop ?? lead?.stop ?? signal?.invalidation ?? null,
    target: activeBuy?.target ?? lead?.target ?? signal?.target ?? null,
    rewardRisk: activeBuy?.rewardRisk ?? lead?.rewardRisk ?? signal?.rewardRisk ?? null,
  };
}

function forecastFor({
  direction,
  orderShape,
  activeBuy,
  accountSize,
  riskPct,
  maxDailyLossPct,
}: {
  direction: FusionPrediction["direction"];
  orderShape: ReturnType<typeof orderShapeFor>;
  activeBuy?: BuyNowSignal;
  accountSize: number;
  riskPct: number;
  maxDailyLossPct: number;
}) {
  if (!orderShape.entry || !orderShape.stop || !orderShape.target || direction === "hold" || direction === "review") {
    return {
      units: 0,
      notional: 0,
      expectedMovePct: 0,
      projectedPnl: 0,
      maxLoss: 0,
      label: direction === "review" ? "No revenue forecast until data refresh" : "No trade forecast",
    };
  }

  const entry = orderShape.entry;
  const stop = orderShape.stop;
  const target = orderShape.target;
  const riskBudget = Math.min(accountSize * (Math.max(0, riskPct) / 100), accountSize * (Math.max(0.1, maxDailyLossPct) / 100));
  const riskDistance = Math.max(Math.abs(entry - stop), entry * 0.0025);
  const units = activeBuy?.units ?? Math.max(1, Math.floor(riskBudget / riskDistance));
  const notional = Number((units * entry).toFixed(2));
  const rawPnl = direction === "sell" ? (entry - target) * units : (target - entry) * units;
  const rawLoss = direction === "sell" ? Math.max(0, stop - entry) * units : Math.max(0, entry - stop) * units;
  const expectedMovePct = direction === "sell" ? ((entry - target) / entry) * 100 : ((target - entry) / entry) * 100;
  return {
    units,
    notional,
    expectedMovePct: Number(expectedMovePct.toFixed(2)),
    projectedPnl: Number(rawPnl.toFixed(2)),
    maxLoss: activeBuy?.maxLoss ?? Number(rawLoss.toFixed(2)),
    label: direction === "sell" ? "Projected downside/avoidance value" : "Projected gross paper P/L at target",
  };
}

function thesisFor({
  quote,
  action,
  finalScore,
  confidence,
  topSupports,
  topChallenges,
  score,
  backtest,
  agent,
}: {
  quote: SignalQuote;
  action: FusionAlphaAction;
  finalScore: number;
  confidence: number;
  topSupports: FusionEngineFinding[];
  topChallenges: FusionEngineFinding[];
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
}) {
  const supportText = topSupports.length ? topSupports.map((item) => item.label).join(", ") : "no strong support engines";
  const challengeText = topChallenges.length ? ` Main challenges: ${topChallenges.map((item) => item.label).join(", ")}.` : "";
  const factorText = score ? ` Factor ensemble ${score.ensembleScore}/100.` : "";
  const backtestText = backtest ? ` Backtest ${backtest.trades} trade(s), ${pct(backtest.totalReturnPct)} return, PF ${backtest.profitFactor}.` : "";
  const agentText = agent ? ` TradingAgents: ${agent.rating}.` : "";
  return `${quote.symbol} fusion action is ${action} with score ${finalScore}/100 and confidence ${confidence}/100. Support comes from ${supportText}.${factorText}${backtestText}${agentText}${challengeText}`;
}

function operatorActionFor({
  action,
  activeBuy,
  lead,
  signal,
  blockers,
}: {
  action: FusionAlphaAction;
  activeBuy?: BuyNowSignal;
  lead?: BuyLead;
  signal?: TradeSignal;
  blockers: string[];
}) {
  if (blockers.length && action === "Data Review") return "Do not trade. Refresh market data and rerun Fusion Alpha.";
  if (action === "Strong Buy / Paper Candidate" && activeBuy) return `Paper candidate: mirror only after checking order ticket at ${money(activeBuy.entry)}, stop ${money(activeBuy.stop)}, target ${money(activeBuy.target)}.`;
  if (action === "Buy Watch" && lead) return `Watch for trigger ${money(lead.trigger)} with fresh data; no entry before trigger and risk check.`;
  if (action === "Sell / Avoid" || action === "Reduce / Avoid Adds") return "Protect capital: avoid new long exposure and review existing exposure against the exit rule.";
  if (signal?.action === "Sell/Exit Watch") return "Exit-watch is active; do not add risk until it clears.";
  return "Hold. Wait for stronger agreement across signal, factor, backtest, and agent layers.";
}

function conflictList({
  signal,
  score,
  backtest,
  agent,
  engineFindings,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  engineFindings: FusionEngineFinding[];
}) {
  const conflicts = [
    signal?.action === "Buy Watch" && score?.recommendation === "Avoid / Sell Watch" ? "Rule signal is bullish but Algorithm Council is risk-off." : "",
    signal?.action === "Sell/Exit Watch" && score && score.ensembleScore >= 65 ? "Rule signal is risk-off while factor score is constructive." : "",
    backtest && backtest.trades > 0 && backtest.totalReturnPct <= 0 && signal?.action === "Buy Watch" ? "Buy setup conflicts with negative historical breakout test." : "",
    agent?.rating === "Data Review" && signal?.action !== "Hold/No Trade" ? "TradingAgents blocks the idea on data quality while rules still emit a setup." : "",
  ].filter(Boolean);
  const bullish = engineFindings.filter((item) => item.stance === "bullish").length;
  const bearish = engineFindings.filter((item) => item.stance === "bearish" || item.stance === "risk-off").length;
  if (bullish >= 3 && bearish >= 3) conflicts.push("Engine map is split; treat as a high-conflict setup.");
  return conflicts;
}

function blockerList({
  signal,
  blockedBuy,
  agent,
  backtest,
}: {
  signal?: TradeSignal;
  blockedBuy?: BlockedBuyNowSignal;
  agent?: TradingAgentsDecision;
  backtest?: BacktestSymbolResult;
}) {
  return [
    !signal?.dataFresh ? "Quote is stale or unavailable." : "",
    ...(blockedBuy?.blockers ?? []).slice(0, 3),
    agent?.rating === "Data Review" ? "TradingAgents requires data refresh before action." : "",
    backtest?.status === "insufficient-data" ? "Historical backtest has insufficient data." : "",
  ].filter(Boolean);
}

function impactFor(score: number, status: FusionFindingStatus): FusionEngineFinding["impact"] {
  if (status === "blocked") return "guards";
  if (score >= 64) return "supports";
  if (score <= 42) return "challenges";
  return "neutral";
}

function stanceFor(score: number): FusionStance {
  if (score >= 64) return "bullish";
  if (score <= 32) return "risk-off";
  if (score <= 42) return "bearish";
  return "neutral";
}

function averageFactor(score: AlgorithmCouncilScore | undefined, names: string[], fallback = 50) {
  if (!score) return fallback;
  const values = names
    .map((name) => score.factorScores.find((factor) => factor.name.toLowerCase().includes(name.toLowerCase()))?.score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? average(values) : fallback;
}

function validationRecord(backtest: BacktestSymbolResult | undefined) {
  return backtest?.validation && typeof backtest.validation === "object" ? (backtest.validation as Record<string, unknown>) : null;
}

function validationEvidence(backtest: BacktestSymbolResult | undefined) {
  const validation = validationRecord(backtest);
  if (!validation) return "No walk-forward validation loaded.";
  const outOfSample = recordField(validation, "outOfSample");
  return `Validation ${String(validation.status ?? "unknown")}; out-of-sample trades ${numberField(outOfSample, "trades")}, return ${pct(numberField(outOfSample, "totalReturnPct"))}.`;
}

function backtestStatus(backtest: BacktestSymbolResult | undefined) {
  if (!backtest) return "Backtest unavailable.";
  return `${backtest.status}: ${backtest.trades} trade(s), ${pct(backtest.totalReturnPct)} return, ${pct(backtest.maxDrawdownPct)} max drawdown, PF ${backtest.profitFactor}.`;
}

function proxyEvidence({ signal, score, backtest }: { signal?: TradeSignal; score?: AlgorithmCouncilScore; backtest?: BacktestSymbolResult }) {
  return [
    signal ? `Rule signal: ${signal.action} ${signal.quality}/${signal.confidence}` : "Rule signal unavailable.",
    score ? `Factor ensemble: ${score.ensembleScore}/100` : "Factor ensemble unavailable.",
    backtestStatus(backtest),
  ];
}

function agreementEvidence({
  signal,
  score,
  backtest,
  agent,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
}) {
  return [
    signal ? `Signal ${signal.action}` : "No signal",
    score ? `Council ${score.recommendation}` : "No council score",
    backtest ? `Backtest ${pct(backtest.totalReturnPct)}` : "No backtest",
    agent ? `Agent ${agent.rating}` : "No agent debate",
  ];
}

function pipelineEvidence({
  signal,
  score,
  backtest,
  agent,
  activeBuy,
}: {
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: BacktestSymbolResult;
  agent?: TradingAgentsDecision;
  activeBuy?: BuyNowSignal;
}) {
  return [
    signal ? "Rule feature present." : "Rule feature missing.",
    score ? "Factor feature present." : "Factor feature missing.",
    backtest ? "Backtest feature present." : "Backtest feature missing.",
    agent ? "Agent debate present." : "Agent debate missing.",
    activeBuy ? "Executable ticket present." : "Executable ticket missing.",
  ];
}

function recordField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function numberField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreLower(value: number, bad: number, good: number) {
  if (!Number.isFinite(value)) return 50;
  if (bad === good) return 50;
  return clamp(((bad - value) / (bad - good)) * 100, 0, 100);
}

function bySymbol<T extends { symbol: string }>(items: T[]) {
  return new Map(items.map((item) => [item.symbol, item]));
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) return 50;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pct(value: number | undefined | null) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)}%`;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function countWord(text: string, word: string) {
  return text.split(word).length - 1;
}

function isCryptoSymbol(symbol: string) {
  return symbol.includes("/") || ["BTCUSD", "ETHUSD", "BTC", "ETH", "SOL"].includes(symbol);
}
