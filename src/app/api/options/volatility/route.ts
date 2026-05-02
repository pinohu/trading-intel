import { NextResponse } from "next/server";
import { buildOptionsVolatilityReports } from "@/lib/optionsIntelligence";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { parseSymbols } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 8);
  const mode = modeFromRequest(request);
  const persist = url.searchParams.get("persist") !== "false";
  const reports = await buildOptionsVolatilityReports({ symbols, mode, persist });
  return NextResponse.json({
    ok: true,
    mode,
    reports,
    advisory:
      "Options volatility data is context only. OPRA is licensed; indicative/contract-only outputs are not execution-grade.",
  });
}
