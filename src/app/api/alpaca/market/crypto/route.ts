import { NextResponse } from "next/server";
import { getCryptoSnapshots } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbols, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  const symbols = cleanSymbols(searchParams.get("symbols") ?? "BTC/USD,ETH/USD", 20);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, mode, error: "At least one crypto symbol is required." }, { status: 400 });
  }

  try {
    const snapshots = await getCryptoSnapshots(symbols, mode);
    return NextResponse.json({ ok: true, mode, symbols, snapshots });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Alpaca crypto market-data request failed.");
  }
}
