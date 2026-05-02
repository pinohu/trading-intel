import { NextResponse } from "next/server";
import { getAccountActivities } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const query = passthroughQuery(searchParams) || "direction=desc&page_size=50";
    const activities = await getAccountActivities(mode, query);
    return NextResponse.json({ ok: true, mode, activities });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker account activity request failed.");
  }
}
