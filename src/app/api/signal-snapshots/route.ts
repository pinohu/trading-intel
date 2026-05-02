import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { quoteToAitableRecord, safeMirrorAitableRecords, signalToAitableRecord } from "@/lib/aitable";
import { databaseConfigured } from "@/lib/db";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertQuoteSnapshot, insertSignalSnapshot } from "@/lib/persistence";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { generateSignals } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const provider = parseProvider(url.searchParams.get("provider"));
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: market.error ?? "Market data unavailable; signal snapshots were skipped", marketStatus: status },
      { status: 502 },
    );
  }
  const quotes = market.quotes ?? [];
  const signals = generateSignals(quotes, riskPct);
  const quoteIdBySymbol = new Map<string, string>();
  const storage = {
    postgres: { ok: false, skipped: !databaseConfigured(), quoteSnapshots: 0, signalSnapshots: 0, error: null as string | null },
    aitable: { ok: false, skipped: true, quoteSnapshots: 0, signalSnapshots: 0, error: null as string | null },
  };

  const signalIds = [];
  if (databaseConfigured()) {
    try {
      for (const quote of quotes) {
        quoteIdBySymbol.set(quote.symbol, await insertQuoteSnapshot(quote, provider));
      }

      for (const signal of signals) {
        signalIds.push(await insertSignalSnapshot(signal, quoteIdBySymbol.get(signal.symbol) ?? null));
      }
      storage.postgres = {
        ok: true,
        skipped: false,
        quoteSnapshots: quoteIdBySymbol.size,
        signalSnapshots: signalIds.length,
        error: null,
      };
    } catch (error) {
      storage.postgres = {
        ok: false,
        skipped: false,
        quoteSnapshots: quoteIdBySymbol.size,
        signalSnapshots: signalIds.length,
        error: error instanceof Error ? error.message : "Signal snapshot storage is unavailable",
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

  if (storage.postgres.ok || storage.aitable.ok) {
    await recordAuditEvent("signal_snapshots.created", null, {
      quotes: storage.postgres.quoteSnapshots || storage.aitable.quoteSnapshots,
      signals: storage.postgres.signalSnapshots || storage.aitable.signalSnapshots,
      provider,
      aitable: storage.aitable.ok,
    });

    return NextResponse.json({
      ok: true,
      quoteSnapshots: storage.postgres.quoteSnapshots || storage.aitable.quoteSnapshots,
      signalSnapshots: storage.postgres.signalSnapshots || storage.aitable.signalSnapshots,
      degraded: market.degraded ?? false,
      signalIds,
      storage,
    });
  }

  return NextResponse.json({ ok: false, error: "No signal snapshot storage is available.", storage }, { status: 503 });
}
