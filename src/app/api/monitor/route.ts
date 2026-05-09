import { NextResponse } from "next/server";
import { quoteToAitableRecord, safeMirrorAitableRecords, signalToAitableRecord } from "@/lib/aitable";
import { sendSignalAlerts } from "@/lib/alerting";
import { generateBuyNowSignals } from "@/lib/buyNowEngine";
import { databaseConfigured } from "@/lib/db";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { evaluateDueSignalOutcomes } from "@/lib/outcomes";
import { insertAlertEvent, insertQuoteSnapshot, insertSignalSnapshot } from "@/lib/persistence";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { cleanSecret } from "@/lib/security";
import { generateBuyLeads, generateSignals } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  if (!cronSecret) return false;
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerSecret === cronSecret || bearer === cronSecret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized monitor request" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols") ?? process.env.MONITOR_WATCHLIST);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct") ?? process.env.DEFAULT_RISK_PCT, 1, 0, 5);
  const accountSize = parseNumberParam(url.searchParams.get("accountSize") ?? process.env.DEFAULT_ACCOUNT_SIZE, 10000, 100, 100000000);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct") ?? process.env.DEFAULT_MAX_DAILY_LOSS_PCT, 3, 0.1, 20);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json(
      { ok: false, ranAt: new Date().toISOString(), degraded: true, error: market.error ?? "Market data unavailable" },
      { status },
    );
  }
  const quotes = market.quotes ?? [];
  const signals = generateSignals(quotes, riskPct);
  const buyLeads = generateBuyLeads(quotes, riskPct);
  const buyNow = generateBuyNowSignals({
    quotes,
    accountSize,
    riskPct,
    maxDailyLossPct,
  });
  const actionable = signals.filter((signal) => signal.action !== "Hold/No Trade" && (signal.quality === "A" || signal.quality === "B"));
  const topBuyLeads = buyLeads.filter((lead) => lead.status !== "No Buy").slice(0, 5);
  const signalStorage = await persistMonitorSignals(quotes, signals, "monitor");
  const alertResults = process.env.SEND_MONITOR_ALERTS === "true" ? await sendSignalAlerts(actionable) : [];
  const outcomeEvaluation = await evaluateDueSignalOutcomes({
    request,
    origin: url.origin,
    limitPerHorizon: 80,
  }).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Outcome evaluation failed.",
  }));
  const alertEvent =
    databaseConfigured() && (alertResults.length > 0 || actionable.length > 0)
      ? await insertAlertEvent({
          alertType: "monitor_signal_scan",
          symbol: actionable[0]?.symbol ?? null,
          severity: actionable.length ? "warning" : "info",
          title: actionable.length ? `Monitor found ${actionable.length} action signal(s)` : "Monitor found no action signal",
          message: actionable.length
            ? actionable.slice(0, 5).map((signal) => `${signal.symbol} ${signal.action} ${signal.quality}/${signal.confidence}`).join("; ")
            : "No actionable buy/sell-watch signals.",
          channels: alertResults.map((result) => result.channel),
          deliveryResults: alertResults as unknown as Array<Record<string, unknown>>,
          source: "cron",
        }).catch((error) => ({ error: error instanceof Error ? error.message : "Alert event storage failed." }))
      : null;

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    symbols,
    degraded: market.degraded ?? false,
    actionable,
    buyNow: buyNow.buyNow,
    buyNowBlocked: buyNow.blocked,
    topBuyLeads,
    signalStorage,
    alertResults,
    alertEvent,
    alertsEnabled: process.env.SEND_MONITOR_ALERTS === "true",
    outcomeEvaluation,
    liveTradingEnabled: false,
  });
}

async function persistMonitorSignals(
  quotes: Array<Parameters<typeof quoteToAitableRecord>[0]>,
  signals: Array<Parameters<typeof signalToAitableRecord>[0]>,
  provider: string,
) {
  const storage = {
    postgres: { ok: false, skipped: !databaseConfigured(), quoteSnapshots: 0, signalSnapshots: 0, error: null as string | null },
    aitable: { ok: false, skipped: true, quoteSnapshots: 0, signalSnapshots: 0, error: null as string | null },
  };
  if (databaseConfigured()) {
    try {
      const quoteIds = new Map<string, string>();
      for (const quote of quotes) {
        quoteIds.set(quote.symbol, await insertQuoteSnapshot(quote, provider));
      }
      let signalCount = 0;
      for (const signal of signals) {
        await insertSignalSnapshot(signal, quoteIds.get(signal.symbol) ?? null);
        signalCount += 1;
      }
      storage.postgres = { ok: true, skipped: false, quoteSnapshots: quoteIds.size, signalSnapshots: signalCount, error: null };
    } catch (error) {
      storage.postgres = {
        ok: false,
        skipped: false,
        quoteSnapshots: storage.postgres.quoteSnapshots,
        signalSnapshots: storage.postgres.signalSnapshots,
        error: error instanceof Error ? error.message : "Monitor signal storage failed.",
      };
    }
  }

  const [quoteMirror, signalMirror] = await Promise.all([
    safeMirrorAitableRecords("quoteSnapshots", quotes.map((quote) => quoteToAitableRecord(quote, provider))),
    safeMirrorAitableRecords("signalSnapshots", signals.map(signalToAitableRecord)),
  ]);
  storage.aitable = {
    ok: quoteMirror.ok || signalMirror.ok,
    skipped: quoteMirror.skipped && signalMirror.skipped,
    quoteSnapshots: quoteMirror.records,
    signalSnapshots: signalMirror.records,
    error: [quoteMirror.error, signalMirror.error].filter(Boolean).join("; ") || null,
  };
  return storage;
}
