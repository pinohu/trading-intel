import { NextResponse } from "next/server";
import { getBrokerAccount } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { readiness, response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const account = await getBrokerAccount(mode);
    return NextResponse.json({ ok: true, mode: readiness.mode, account });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker account request failed.");
  }
}
