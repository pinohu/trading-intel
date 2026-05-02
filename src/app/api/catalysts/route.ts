import { NextResponse } from "next/server";
import { buildCatalystReport } from "@/lib/catalystEngine";
import { parseSymbols } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 16);
  const persist = url.searchParams.get("persist") !== "false";
  try {
    const report = await buildCatalystReport({ request, origin: url.origin, symbols, persist });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Catalyst report failed.", events: [] },
      { status: 503 },
    );
  }
}
