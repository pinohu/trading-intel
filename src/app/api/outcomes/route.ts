import { NextResponse } from "next/server";
import { evaluateDueSignalOutcomes, recentSignalOutcomes } from "@/lib/outcomes";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 100, 1, 500);
  try {
    const outcomes = await recentSignalOutcomes(limit);
    return NextResponse.json({ ok: true, outcomes });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Signal outcomes are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const limitPerHorizon = parseNumberParam(url.searchParams.get("limitPerHorizon"), 60, 1, 250);
  try {
    const result = await evaluateDueSignalOutcomes({
      request,
      origin: url.origin,
      limitPerHorizon,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Outcome evaluation failed." },
      { status: 503 },
    );
  }
}
