import { NextResponse } from "next/server";
import { getMarketCalendar } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const calendar = await getMarketCalendar(mode, passthroughQuery(searchParams));
    return NextResponse.json({ ok: true, mode, calendar });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker market calendar request failed.");
  }
}
