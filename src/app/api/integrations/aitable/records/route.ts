import { NextResponse } from "next/server";
import { listAitableRecords, type AitableTableKey } from "@/lib/aitable";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

const allowedTables = new Set<AitableTableKey>([
  "quoteSnapshots",
  "signalSnapshots",
  "tradeTickets",
  "paperTrades",
  "brokerOrders",
  "signalOutcomes",
  "watchlist",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") as AitableTableKey | null;
  if (!table || !allowedTables.has(table)) {
    return NextResponse.json({ ok: false, error: "A valid AITable table key is required." }, { status: 400 });
  }

  const limit = parseNumberParam(searchParams.get("limit"), 50, 1, 1000);
  try {
    const response = await listAitableRecords(table, limit);
    return NextResponse.json({ ok: true, table, records: response.data?.records ?? [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, table, error: error instanceof Error ? error.message : "AITable records request failed." },
      { status: 503 },
    );
  }
}
