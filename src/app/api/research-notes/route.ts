import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { databaseConfigured, databaseUnavailableResponse } from "@/lib/db";
import { insertResearchNote, listResearchNotes, validResearchNotePayload } from "@/lib/persistence";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json(databaseUnavailableResponse(), { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 50, 1, 200);
  const symbol = searchParams.get("symbol");
  try {
    const notes = await listResearchNotes(limit, symbol);
    return NextResponse.json({ ok: true, source: "postgres", notes });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Research notes are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json(databaseUnavailableResponse(), { status: 503 });
  }
  const payload = await request.json().catch(() => null);
  if (!validResearchNotePayload(payload)) {
    return NextResponse.json({ ok: false, error: "Invalid research note payload." }, { status: 400 });
  }
  try {
    const note = await insertResearchNote({
      ...payload,
      symbol: payload.symbol.trim().toUpperCase(),
      tags: payload.tags?.map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
    });
    await recordAuditEvent("research_note.created", null, {
      symbol: String(note.symbol),
      noteType: String(note.note_type),
      source: String(note.source),
    });
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Research note storage failed." },
      { status: 503 },
    );
  }
}
