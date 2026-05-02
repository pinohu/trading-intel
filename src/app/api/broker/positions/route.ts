import { NextResponse } from "next/server";
import { brokerReadiness, closeAllBrokerPositions, getBrokerPositions } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials, truthyConfirmation } from "@/lib/brokerRoutes";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { readiness, response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const positions = await getBrokerPositions(mode);
    return NextResponse.json({ ok: true, mode: readiness.mode, positions });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker positions request failed.");
  }
}

export async function DELETE(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to close positions." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.executionEnabled || !readiness.credentialsConfigured || (mode === "live" && !readiness.orderPlacementReady)) {
    return NextResponse.json({ ok: false, mode, error: "Broker execution is not ready.", readiness }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: string; cancelOrders?: boolean } | null;
  const expected = mode === "live" ? cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK) : "CLOSE PAPER POSITIONS";
  if (!truthyConfirmation(body?.confirmation, expected)) {
    return NextResponse.json({ ok: false, mode, error: "Position close confirmation did not match." }, { status: 400 });
  }

  try {
    const result = await closeAllBrokerPositions(mode, body?.cancelOrders !== false);
    return NextResponse.json({ ok: true, mode, result });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker close-all positions request failed.");
  }
}
