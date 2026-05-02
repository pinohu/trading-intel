import { NextResponse } from "next/server";
import { getCorporateActions } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const corporateActions = await getCorporateActions(mode, passthroughQuery(searchParams));
    return NextResponse.json({ ok: true, mode, corporateActions });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Alpaca corporate actions request failed.");
  }
}
