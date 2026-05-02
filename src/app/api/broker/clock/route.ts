import { NextResponse } from "next/server";
import { getMarketClock } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const clock = await getMarketClock(mode);
    return NextResponse.json({ ok: true, mode, clock });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker market clock request failed.");
  }
}
