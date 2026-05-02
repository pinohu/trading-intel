import { NextResponse } from "next/server";
import { reconcileBrokerState } from "@/lib/brokerReconciliation";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";
import { hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;
  return NextResponse.json({
    ok: true,
    mode,
    streamEndpoint: mode === "live" ? "wss://api.alpaca.markets/stream" : "wss://paper-api.alpaca.markets/stream",
    stream: "trade_updates",
    note: "Use POST to run REST reconciliation. Use a persistent worker for WebSocket trade_updates.",
  });
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to reconcile broker state." }, { status: 401 });
  }
  const mode = modeFromRequest(request);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;
  try {
    const result = await reconcileBrokerState({ mode });
    return NextResponse.json(result);
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker reconciliation failed.");
  }
}
