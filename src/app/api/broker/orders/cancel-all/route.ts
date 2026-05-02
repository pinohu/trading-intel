import { NextResponse } from "next/server";
import { brokerReadiness, cancelAllBrokerOrders } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, truthyConfirmation } from "@/lib/brokerRoutes";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to cancel broker orders." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.executionEnabled || !readiness.credentialsConfigured) {
    return NextResponse.json({ ok: false, mode, error: "Broker execution is not ready.", readiness }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  const expected = mode === "live" ? cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK) : "CANCEL PAPER ORDERS";
  if (!truthyConfirmation(body?.confirmation, expected)) {
    return NextResponse.json({ ok: false, mode, error: "Cancel-all confirmation did not match." }, { status: 400 });
  }

  try {
    const orders = await cancelAllBrokerOrders(mode);
    return NextResponse.json({ ok: true, mode, orders });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker cancel-all orders request failed.");
  }
}
