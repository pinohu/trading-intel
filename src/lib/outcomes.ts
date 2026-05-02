import { signalOutcomeToAitableRecord, safeMirrorAitableRecords } from "@/lib/aitable";
import { databaseConfigured } from "@/lib/db";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertSignalOutcome, listDueSignalSnapshots, listSignalOutcomes, type DueSignalSnapshot } from "@/lib/persistence";
import { symbolsParam } from "@/lib/requestGuards";
import type { SignalQuote } from "@/lib/signalEngine";

export type OutcomeHorizon = {
  label: string;
  minutes: number;
};

export const defaultOutcomeHorizons: OutcomeHorizon[] = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "1d", minutes: 390 },
];

export async function evaluateDueSignalOutcomes({
  request,
  origin,
  horizons = defaultOutcomeHorizons,
  limitPerHorizon = 60,
}: {
  request: Request;
  origin: string;
  horizons?: OutcomeHorizon[];
  limitPerHorizon?: number;
}) {
  if (!databaseConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: "DATABASE_URL is not configured.",
      evaluated: 0,
      inserted: 0,
      horizons: [],
    };
  }

  const dueByHorizon = await Promise.all(
    horizons.map(async (horizon) => ({
      horizon,
      due: await listDueSignalSnapshots(horizon.label, horizon.minutes, limitPerHorizon),
    })),
  );
  const due = dueByHorizon.flatMap((item) => item.due.map((signal) => ({ signal, horizon: item.horizon })));
  const symbols = Array.from(new Set(due.map((item) => item.signal.symbol)));
  if (symbols.length === 0) {
    return { ok: true, skipped: false, evaluated: 0, inserted: 0, horizons: dueByHorizon.map(summaryForHorizon) };
  }

  const marketUrl = new URL("/api/market", origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  const { ok, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return {
      ok: false,
      skipped: false,
      evaluated: due.length,
      inserted: 0,
      error: market.error ?? "Market data unavailable while evaluating outcomes.",
      horizons: dueByHorizon.map(summaryForHorizon),
    };
  }

  const quoteBySymbol = new Map((market.quotes ?? []).map((quote: SignalQuote) => [quote.symbol, quote]));
  const inserted = [];
  const mirrorRecords = [];

  for (const item of due) {
    const quote = quoteBySymbol.get(item.signal.symbol);
    if (!quote) continue;
    const outcome = buildOutcome(item.signal, item.horizon.label, quote.price);
    const row = await insertSignalOutcome(outcome);
    inserted.push(row);
    mirrorRecords.push(
      signalOutcomeToAitableRecord({
        signalKey: item.signal.id,
        symbol: item.signal.symbol,
        horizon: item.horizon.label,
        observedPrice: outcome.observedPrice,
        returnPct: outcome.returnPct,
        hitTarget: outcome.hitTarget,
        hitStop: outcome.hitStop,
        raw: { signal: item.signal, quote },
      }),
    );
  }

  const mirror = await safeMirrorAitableRecords("signalOutcomes", mirrorRecords);
  return {
    ok: true,
    skipped: false,
    evaluated: due.length,
    inserted: inserted.length,
    degraded: market.degraded ?? false,
    horizons: dueByHorizon.map(summaryForHorizon),
    aitableMirror: mirror,
  };
}

export async function recentSignalOutcomes(limit = 100) {
  if (!databaseConfigured()) return [];
  return listSignalOutcomes(limit);
}

function buildOutcome(signal: DueSignalSnapshot, horizon: string, observedPrice: number) {
  const direction = signal.action === "Sell/Exit Watch" ? -1 : 1;
  const rawReturn = ((observedPrice - signal.price) / signal.price) * 100;
  const returnPct = Number((rawReturn * direction).toFixed(4));
  const hitTarget =
    signal.action === "Sell/Exit Watch"
      ? observedPrice <= signal.target
      : observedPrice >= signal.target;
  const hitStop =
    signal.action === "Sell/Exit Watch"
      ? observedPrice >= signal.invalidation
      : observedPrice <= signal.invalidation;

  return {
    signalSnapshotId: signal.id,
    horizon,
    observedPrice,
    returnPct,
    hitTarget,
    hitStop,
  };
}

function summaryForHorizon(item: { horizon: OutcomeHorizon; due: DueSignalSnapshot[] }) {
  return { horizon: item.horizon.label, due: item.due.length };
}
