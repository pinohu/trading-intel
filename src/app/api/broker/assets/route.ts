import { NextResponse } from "next/server";
import { getAsset, listAssets } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbol, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const symbol = cleanSymbol(searchParams.get("symbol") ?? undefined);
    if (symbol) {
      const asset = await getAsset(symbol, mode);
      return NextResponse.json({ ok: true, mode, asset });
    }
    const assets = await listAssets(mode, passthroughQuery(searchParams) || "status=active");
    return NextResponse.json({ ok: true, mode, assets });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker assets request failed.");
  }
}
