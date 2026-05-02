import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { runMomentumBreakoutBacktest } from "@/lib/backtesting";
import { databaseConfigured } from "@/lib/db";
import { scoreAlgorithmCouncil, rankAlgorithmCouncilScores } from "@/lib/factorEngine";
import { fetchFundamentalSnapshot } from "@/lib/fundamentals";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertResearchNote } from "@/lib/persistence";
import { symbolsParam } from "@/lib/requestGuards";
import { cleanSecret, hasValidUserSession } from "@/lib/security";
import { generateSignals } from "@/lib/signalEngine";
import { buildNativeTradingAgentsDebate, NATIVE_TRADING_AGENTS_SOURCE } from "@/lib/tradingAgentsNative";
import {
  cleanTradingAgentsDate,
  formatTradingAgentsNote,
  parseTradingAgentsSymbols,
  validTradingAgentsDepth,
  type TradingAgentsDecision,
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

  try {
    const analysis = await runNativeCodebaseTradingAgents(request, symbols, analysisDate, depth, provider);
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

async function runNativeCodebaseTradingAgents(
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
  const debates = symbols.map((symbol) =>
    buildNativeTradingAgentsDebate({
      symbol,
      quote: quotes.find((item) => item.symbol === symbol),
      signal: signals.find((item) => item.symbol === symbol),
      score: scores.find((item) => item.symbol === symbol),
      backtest: backtest.results.find((item) => item.symbol === symbol),
      depth,
    }),
  );

  return {
    source: NATIVE_TRADING_AGENTS_SOURCE,
    decisions: debates.map((debate) => debate.decision),
    raw: {
      market: {
        provider: market.provider,
        degraded: market.degraded ?? false,
        unavailableSymbols: market.unavailableSymbols ?? [],
      },
      signals,
      algorithmScores: scores,
      backtest,
      agentDebates: Object.fromEntries(
        debates.map((debate) => [
          debate.decision.symbol,
          {
            consensusScore: debate.consensusScore,
            transcript: debate.transcript,
          },
        ]),
      ),
    },
    advisory:
      "TradingAgents now runs inside this codebase. It uses current quotes, SEC/factor evidence, rule signals, and Alpaca historical bars; manual paper/live execution still happens through the visible broker controls.",
  };
}

async function persistTradingAgentsNotes(
  decisions: TradingAgentsDecision[],
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
      tags: [source === NATIVE_TRADING_AGENTS_SOURCE ? "native-codebase" : "tradingagents", "research-only", depth],
      source,
    });
    inserted.push(note);
  }
  return inserted;
}
