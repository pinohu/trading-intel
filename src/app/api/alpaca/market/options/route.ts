import { NextResponse } from "next/server";
import { getOptionContracts, getOptionSnapshots } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbols, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  const kind = searchParams.get("kind")?.trim().toLowerCase() ?? "contracts";

  try {
    if (kind === "snapshots") {
      const symbols = cleanSymbols(searchParams.get("symbols"), 100);
      if (symbols.length === 0) {
        return NextResponse.json({ ok: false, mode, error: "Option contract symbols are required for snapshots." }, { status: 400 });
      }
      const snapshots = await getOptionSnapshots(symbols, mode, searchParams.get("feed") ?? undefined);
      return NextResponse.json({ ok: true, mode, kind, symbols, snapshots });
    }

    const underlyingSymbols = cleanSymbols(searchParams.get("underlyingSymbols") ?? searchParams.get("symbols") ?? "SPY,QQQ,NVDA", 20);
    const contracts = await getOptionContracts(underlyingSymbols, mode, passthroughQuery(searchParams, ["kind", "symbols", "underlyingSymbols"]));
    return NextResponse.json({ ok: true, mode, kind: "contracts", underlyingSymbols, contracts });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Alpaca options market-data request failed.");
  }
}
