import { NextResponse } from "next/server";
import { brokerReadiness, closeBrokerPosition, getBrokerPosition } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbol, modeFromRequest, truthyConfirmation } from "@/lib/brokerRoutes";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.credentialsConfigured) {
    return NextResponse.json({ ok: false, mode, error: `${mode} Alpaca credentials are not configured.`, readiness }, { status: 503 });
  }

  const symbol = cleanSymbol((await params).symbol);
  if (!symbol) {
    return NextResponse.json({ ok: false, mode, error: "A valid symbol is required." }, { status: 400 });
  }

  try {
    const position = await getBrokerPosition(symbol, mode);
    return NextResponse.json({ ok: true, mode, position });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker position request failed.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to close broker positions." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.executionEnabled || !readiness.credentialsConfigured || (mode === "live" && !readiness.orderPlacementReady)) {
    return NextResponse.json({ ok: false, mode, error: "Broker execution is not ready.", readiness }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: string; percentage?: number } | null;
  const expected = mode === "live" ? cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK) : "CLOSE PAPER POSITION";
  if (!truthyConfirmation(body?.confirmation, expected)) {
    return NextResponse.json({ ok: false, mode, error: "Position close confirmation did not match." }, { status: 400 });
  }

  const symbol = cleanSymbol((await params).symbol);
  if (!symbol) {
    return NextResponse.json({ ok: false, mode, error: "A valid symbol is required." }, { status: 400 });
  }

  try {
    const position = await closeBrokerPosition(symbol, mode, body?.percentage);
    return NextResponse.json({ ok: true, mode, position });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker position close failed.");
  }
}
