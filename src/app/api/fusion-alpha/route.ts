import { NextResponse } from "next/server";
import { runMomentumBreakoutBacktest } from "@/lib/backtesting";
import { brokerReadiness } from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { scoreAlgorithmCouncil, rankAlgorithmCouncilScores } from "@/lib/factorEngine";
import { fetchFundamentalSnapshot } from "@/lib/fundamentals";
import { buildFusionAlphaPredictions, fusionAlphaModelVersion } from "@/lib/fusionAlpha";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { buildResearchStackReadiness } from "@/lib/researchStack";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { generateBuyLeads, generateSignals } from "@/lib/signalEngine";
import { buildNativeTradingAgentsDebate } from "@/lib/tradingAgentsNative";
import { validTradingAgentsDepth, type TradingAgentsDepth } from "@/lib/tradingAgents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = modeFromRequest(request);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 8);
  const provider = parseProvider(url.searchParams.get("provider"));
  const lookbackDays = Math.round(parseNumberParam(url.searchParams.get("lookbackDays"), 180, 60, 365));
  const accountSize = parseNumberParam(url.searchParams.get("accountSize"), 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const depth: TradingAgentsDepth = validTradingAgentsDepth(url.searchParams.get("depth")) ? (url.searchParams.get("depth") as TradingAgentsDepth) : "standard";

  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);
  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  const quotes = (market.quotes ?? []).filter((quote) => symbols.includes(quote.symbol));
  if (!ok || quotes.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        source: "fusion-alpha-v1",
        modelVersion: fusionAlphaModelVersion,
        error: market.error ?? "Market data unavailable; Fusion Alpha could not run.",
      },
      { status },
    );
  }

  const signals = generateSignals(quotes, riskPct);
  const buyLeads = generateBuyLeads(quotes, riskPct);
  const buyNow = generateBuyNowSignals({
    quotes,
    accountSize,
    riskPct,
    maxDailyLossPct,
  });
  const fundamentalsAndScores = await Promise.all(
    quotes.map(async (quote) => {
      const fundamentals = await fetchFundamentalSnapshot(quote.symbol, quote);
      return { fundamentals, score: scoreAlgorithmCouncil({ quote, fundamentals }) };
    }),
  );
  const algorithmScores = rankAlgorithmCouncilScores(fundamentalsAndScores.map((item) => item.score));
  const supportedBacktestSymbols = symbols.filter((symbol) => !["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY", "BTCUSD", "ETHUSD"].includes(symbol));
  const backtest = supportedBacktestSymbols.length
    ? await runMomentumBreakoutBacktest({
        symbols: supportedBacktestSymbols,
        lookbackDays,
        mode,
        slippageBps: 5,
        feeBps: 1,
      })
    : null;
  const decisions = quotes.map((quote) =>
    buildNativeTradingAgentsDebate({
      symbol: quote.symbol,
      quote,
      signal: signals.find((item) => item.symbol === quote.symbol),
      score: algorithmScores.find((item) => item.symbol === quote.symbol),
      backtest: backtest?.results.find((item) => item.symbol === quote.symbol),
      depth,
    }).decision,
  );
  const researchStack = buildResearchStackReadiness();
  const readiness = await brokerReadiness(mode).catch(() => null);
  const predictions = buildFusionAlphaPredictions({
    quotes,
    signals,
    buyLeads,
    buyNow: buyNow.buyNow,
    blockedBuyNow: buyNow.blocked,
    algorithmScores,
    backtestResults: backtest?.results ?? [],
    tradingAgents: decisions,
    researchComponents: researchStack.components,
    brokerReady: Boolean(readiness?.orderPlacementReady),
    accountSize,
    riskPct,
    maxDailyLossPct,
  });

  return NextResponse.json({
    ok: true,
    source: "fusion-alpha-v1",
    modelVersion: fusionAlphaModelVersion,
    generatedAt: new Date().toISOString(),
    mode,
    provider,
    lookbackDays,
    predictions,
    raw: {
      market: {
        provider: market.provider,
        degraded: market.degraded ?? false,
        unavailableSymbols: market.unavailableSymbols ?? [],
      },
      signals,
      buyLeads,
      buyNow,
      algorithmScores,
      backtest,
      tradingAgents: decisions,
      researchStack: {
        grade: researchStack.grade,
        configured: researchStack.configured,
        total: researchStack.total,
      },
      brokerReady: Boolean(readiness?.orderPlacementReady),
    },
    advisory:
      "Fusion Alpha combines every mapped engine and algorithm family into one research prediction. Missing external workers are shown as proxy or blocked evidence, not fabricated worker output.",
  });
}
