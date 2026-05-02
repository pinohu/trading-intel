import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { listAitableRecords, paperTradeToAitableRecord, safeMirrorAitableRecords } from "@/lib/aitable";
import { databaseConfigured, databaseUnavailableResponse } from "@/lib/db";
import { insertPaperTrade, listPaperTrades, validPaperTradePayload } from "@/lib/persistence";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 50, 1, 200);
  if (!databaseConfigured()) {
    try {
      const response = await listAitableRecords("paperTrades", limit);
      return NextResponse.json({
        ok: true,
        source: "aitable",
        trades: aitablePaperTradeFields(response.data?.records ?? []),
      });
    } catch {
      return NextResponse.json(databaseUnavailableResponse(), { status: 503 });
    }
  }
  try {
    const trades = await listPaperTrades(limit);
    return NextResponse.json({ ok: true, source: "postgres", trades });
  } catch (error) {
    try {
      const response = await listAitableRecords("paperTrades", limit);
      return NextResponse.json({
        ok: true,
        source: "aitable",
        postgresError: error instanceof Error ? error.message : "Paper-trade storage is unavailable",
        trades: aitablePaperTradeFields(response.data?.records ?? []),
      });
    } catch {
      return NextResponse.json({ ok: false, error: "Paper-trade storage is unavailable" }, { status: 503 });
    }
  }
}

function aitablePaperTradeFields(records: Array<Record<string, unknown>>) {
  return records
    .map((record) => (record as { fields?: Record<string, unknown> }).fields ?? record)
    .filter((fields) => typeof fields.Symbol === "string" && fields.Symbol.trim().length > 0);
}

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json(databaseUnavailableResponse(), { status: 503 });
  }
  const payload = await request.json().catch(() => null);
  if (!validPaperTradePayload(payload)) {
    return NextResponse.json({ ok: false, error: "Invalid paper-trade payload" }, { status: 400 });
  }
  const cleanPayload = {
    ...payload,
    symbol: payload.symbol.trim().toUpperCase(),
  };
  let trade: Record<string, unknown> | null = null;
  let postgresError: string | null = null;
  if (databaseConfigured()) {
    try {
      trade = await insertPaperTrade(cleanPayload);
      await recordAuditEvent("paper_trade.created", null, {
        symbol: cleanPayload.symbol,
        side: cleanPayload.side,
        units: cleanPayload.units,
      });
    } catch (error) {
      postgresError = error instanceof Error ? error.message : "Paper-trade storage is unavailable";
    }
  } else {
    postgresError = "DATABASE_URL is not configured.";
  }

  const mirror = await safeMirrorAitableRecords("paperTrades", [paperTradeToAitableRecord(cleanPayload)]);
  if (trade || mirror.ok) {
    return NextResponse.json({
      ok: true,
      trade,
      storage: {
        postgres: { ok: Boolean(trade), error: postgresError },
        aitable: mirror,
      },
    }, { status: 201 });
  }

  try {
    throw new Error(postgresError ?? mirror.error ?? "Paper-trade storage is unavailable");
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Paper-trade storage is unavailable" }, { status: 503 });
  }
}
