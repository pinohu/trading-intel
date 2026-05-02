import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { runMomentumBreakoutBacktest } from "@/lib/backtesting";
import { databaseConfigured } from "@/lib/db";
import { runExternalWorkerJob } from "@/lib/externalWorkers";
import { scoreAlgorithmCouncil, rankAlgorithmCouncilScores, type AlgorithmCouncilScore } from "@/lib/factorEngine";
import { fetchFundamentalSnapshot } from "@/lib/fundamentals";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertResearchNote } from "@/lib/persistence";
import { symbolsParam } from "@/lib/requestGuards";
import { cleanSecret, hasValidUserSession } from "@/lib/security";
import { generateSignals, type SignalQuote, type TradeSignal } from "@/lib/signalEngine";
import {
  cleanTradingAgentsDate,
  formatTradingAgentsNote,
  normalizeTradingAgentsDecisions,
  parseTradingAgentsSymbols,
  validTradingAgentsDepth,
  type TradingAgentsDepth,
} from "@/lib/tradingAgents";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized TradingAgents request." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    symbols?: unknown;
    analysisDate?: unknown;
    depth?: unknown;
    provider?: unknown;
  } | null;
  const symbols = parseTradingAgentsSymbols(payload?.symbols);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, error: "Provide 1-8 valid symbols." }, { status: 400 });
  }

  const analysisDate = cleanTradingAgentsDate(payload?.analysisDate);
  const depth: TradingAgentsDepth = validTradingAgentsDepth(payload?.depth) ? payload.depth : "standard";
  const provider = typeof payload?.provider === "string" && payload.provider.length <= 40 ? payload.provider : undefined;
  const workerConfigured = Boolean(cleanSecret(process.env.TRADINGAGENTS_WORKER_URL));

  try {
    const analysis = workerConfigured
      ? await runExternalTradingAgents(symbols, analysisDate, depth, provider)
      : await runNativeRealDataDebate(request, symbols, analysisDate, depth, provider);
    const persistedNotes = await persistTradingAgentsNotes(analysis.decisions, analysisDate, depth, analysis.source);

    await recordAuditEvent("tradingagents.analyze", null, {
      symbols: symbols.join(","),
      analysisDate,
      depth,
      source: analysis.source,
      persistedNotes: persistedNotes.length,
    });

    return NextResponse.json({
      ok: true,
      source: analysis.source,
      requested: { symbols, analysisDate, depth },
      decisions: analysis.decisions,
      persistedNotes,
      raw: analysis.raw,
      advisory: analysis.advisory,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "TradingAgents analysis failed." },
      { status: 503 },
    );
  }
}

async function runExternalTradingAgents(
  symbols: string[],
  analysisDate: string,
  depth: TradingAgentsDepth,
  provider: string | undefined,
) {
  const workerResult = await runExternalWorkerJob("tradingagents", {
    jobType: "agent-debate",
    symbols,
    strategy: "multi-agent trading research debate",
    parameters: {
      analysisDate,
      depth,
      provider,
      maxDebateRounds: depth === "deep" ? 3 : depth === "standard" ? 2 : 1,
      outputContract: "Return decisions with symbol, rating/recommendation, thesis, risks, and portfolioDecision.",
    },
  });

  return {
    source: "tradingagents-worker",
    decisions: normalizeTradingAgentsDecisions(workerResult.data, symbols),
    raw: workerResult.data,
    advisory: "TradingAgents output is research-only. Broker execution remains blocked behind the existing paper/live gates.",
  };
}

async function runNativeRealDataDebate(
  request: Request,
  symbols: string[],
  analysisDate: string,
  depth: TradingAgentsDepth,
  provider: string | undefined,
) {
  const url = new URL(request.url);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  if (provider) marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const quotes = (market.quotes ?? []).filter((quote) => symbols.includes(quote.symbol));
  if (!ok || quotes.length === 0) {
    throw new Error(market.error ?? `Market data unavailable for native real-data debate (${status}).`);
  }

  const signals = generateSignals(quotes, 1);
  const scored = await Promise.all(
    quotes.map(async (quote) => {
      const fundamentals = await fetchFundamentalSnapshot(quote.symbol, quote);
      return scoreAlgorithmCouncil({ quote, fundamentals });
    }),
  );
  const scores = rankAlgorithmCouncilScores(scored);
  const lookbackDays = depth === "deep" ? 365 : depth === "standard" ? 180 : 90;
  const backtest = await runMomentumBreakoutBacktest({
    symbols,
    lookbackDays,
    mode: "paper",
    slippageBps: 5,
    feeBps: 1,
  });
  const decisions = symbols.map((symbol) =>
    buildNativeDecision({
      symbol,
      quote: quotes.find((item) => item.symbol === symbol),
      signal: signals.find((item) => item.symbol === symbol),
      score: scores.find((item) => item.symbol === symbol),
      backtest: backtest.results.find((item) => item.symbol === symbol),
    }),
  );

  return {
    source: "native-real-data-debate",
    decisions,
    raw: {
      market: {
        provider: market.provider,
        degraded: market.degraded ?? false,
        unavailableSymbols: market.unavailableSymbols ?? [],
      },
      signals,
      algorithmScores: scores,
      backtest,
    },
    advisory:
      "Native real-data debate used because TRADINGAGENTS_WORKER_URL is not configured. It uses live/available quotes, SEC fundamentals, rule signals, and historical backtests. Broker execution remains blocked.",
  };
}

function buildNativeDecision({
  symbol,
  quote,
  signal,
  score,
  backtest,
}: {
  symbol: string;
  quote?: SignalQuote;
  signal?: TradeSignal;
  score?: AlgorithmCouncilScore;
  backtest?: {
    trades: number;
    winRate: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
    status: string;
  };
}) {
  const positiveBacktest = Boolean(backtest && backtest.status === "ok" && backtest.trades >= 3 && backtest.totalReturnPct > 0);
  const weakBacktest = Boolean(backtest && (backtest.status !== "ok" || backtest.trades < 3 || backtest.totalReturnPct <= 0));
  const scoreBullish = score?.recommendation === "Strong Buy Watch" || score?.recommendation === "Buy Watch";
  const signalBullish = signal?.action === "Buy Watch";
  const signalBearish = signal?.action === "Sell/Exit Watch";
  const rating =
    signalBearish || score?.recommendation === "Avoid / Sell Watch"
      ? "Risk Review"
      : scoreBullish && signalBullish && positiveBacktest
        ? "Research Buy Watch"
        : scoreBullish || signalBullish || positiveBacktest
          ? "Research Watch"
          : "Hold / No Trade";
  const action =
    rating === "Research Buy Watch"
      ? "Paper-watch candidate only"
      : rating === "Risk Review"
        ? "Avoid or reduce risk until evidence improves"
        : "Monitor; require stronger alignment before paper entry";
  const backtestSummary = backtest
    ? `${backtest.trades} trade(s), ${backtest.winRate}% win, ${backtest.totalReturnPct}% total return, ${backtest.maxDrawdownPct}% max drawdown, PF ${backtest.profitFactor}.`
    : "No backtest result returned.";
  const thesis = [
    quote ? `${symbol} last traded at ${quote.price} from ${quote.source} with ${quote.quality} data quality.` : `${symbol} did not return a usable quote.`,
    signal ? `Rule signal: ${signal.action} (${signal.quality}/${signal.confidence}) because ${signal.reason}` : "No rule signal was available.",
    score ? `Algorithm Council: ${score.recommendation}, ensemble ${score.ensembleScore}, confidence ${score.confidence}. ${score.thesis}` : "Algorithm Council score was unavailable.",
    `Historical evidence: ${backtestSummary}`,
  ].join(" ");
  const risks = [
    ...(signal?.warnings ?? []),
    ...(score?.riskControls ?? []),
    score?.bearCase,
    weakBacktest ? "Historical sample is weak or negative; require more paper evidence before promotion." : "",
    quote?.quality === "Delayed" || quote?.quality === "Unofficial" ? `Data quality is ${quote.quality}; do not treat this as execution-grade.` : "",
  ].filter((item): item is string => Boolean(item));

  return {
    symbol,
    rating,
    action,
    summary: thesis.slice(0, 500),
    thesis,
    risks: risks.length ? risks.slice(0, 8) : ["No major risk note generated, but this remains research-only."],
    portfolioDecision:
      rating === "Research Buy Watch"
        ? "Eligible for paper watch only. Do not route to live broker execution without fresh data, manual review, and stored audit evidence."
        : "Not eligible for automatic order placement. Keep in research/watch mode.",
  };
}

async function persistTradingAgentsNotes(
  decisions: ReturnType<typeof normalizeTradingAgentsDecisions>,
  analysisDate: string,
  depth: TradingAgentsDepth,
  source: string,
) {
  if (!databaseConfigured()) return [];
  const inserted = [];
  for (const decision of decisions) {
    const note = await insertResearchNote({
      symbol: decision.symbol,
      noteType: "tradingagents",
      title: `TradingAgents ${decision.rating}: ${decision.symbol}`,
      body: formatTradingAgentsNote(decision, analysisDate, depth),
      tags: [source === "native-real-data-debate" ? "native-real-data" : "tradingagents", "research-only", depth],
      source,
    });
    inserted.push(note);
  }
  return inserted;
}
