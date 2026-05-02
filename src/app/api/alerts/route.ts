import { NextResponse } from "next/server";
import { sendSignalAlerts } from "@/lib/alerting";
import { generateSignals } from "@/lib/signalEngine";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { databaseConfigured } from "@/lib/db";
import { insertAlertEvent, listAlertEvents } from "@/lib/persistence";
import { parseNumberParam, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 50, 1, 200);
  if (!databaseConfigured()) {
    return NextResponse.json({ ok: true, configured: false, alerts: [] });
  }
  try {
    const alerts = await listAlertEvents(limit);
    return NextResponse.json({ ok: true, configured: true, alerts });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Alerts are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to send manual alerts." }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const riskPct = parseNumberParam(url.searchParams.get("riskPct"), 1, 0, 5);
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json({ ok: false, error: market.error ?? "Market data unavailable." }, { status });
  }

  const actionable = generateSignals(market.quotes ?? [], riskPct).filter(
    (signal) => signal.action !== "Hold/No Trade" && signal.quality !== "Avoid",
  );
  const results = await sendSignalAlerts(actionable);
  const event = databaseConfigured()
    ? await insertAlertEvent({
        alertType: "manual_signal_alert",
        symbol: actionable[0]?.symbol ?? null,
        severity: actionable.length ? "warning" : "info",
        title: actionable.length ? `Signal alert: ${actionable[0].symbol}` : "Signal alert: no action",
        message: actionable.length
          ? actionable.slice(0, 5).map((signal) => `${signal.symbol} ${signal.action} ${signal.quality}/${signal.confidence}`).join("; ")
          : "No actionable signals were present.",
        channels: results.map((result) => result.channel),
        deliveryResults: results as unknown as Array<Record<string, unknown>>,
        source: "manual",
      }).catch((error) => ({ error: error instanceof Error ? error.message : "Alert event storage failed." }))
    : null;

  return NextResponse.json({
    ok: true,
    actionable,
    deliveryResults: results,
    storedEvent: event,
  });
}
