import { NextResponse } from "next/server";
import { fetchFilingCatalysts } from "@/lib/catalystEngine";
import { parseSymbols } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = parseSymbols(searchParams.get("symbols"), 10);
  try {
    const filings = await fetchFilingCatalysts(symbols);
    return NextResponse.json({
      ok: true,
      source: "SEC EDGAR data.sec.gov submissions API",
      symbols,
      filings,
      advisory: "Official filings can explain catalyst risk, but they still require reading and cannot prove a trade will profit.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "SEC filings lookup failed." },
      { status: 503 },
    );
  }
}
