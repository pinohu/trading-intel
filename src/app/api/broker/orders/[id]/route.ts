import { NextResponse } from "next/server";
import { brokerConfig, brokerReadiness, buildReplacementOrderPayload, cancelBrokerOrder, getBrokerOrder, replaceBrokerOrder, validateBrokerOrderPayload } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, truthyConfirmation } from "@/lib/brokerRoutes";
import { evaluatePreTradeControls } from "@/lib/executionControl";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to replace broker orders." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.orderPlacementReady) {
    return NextResponse.json({ ok: false, mode, error: "Broker execution is not ready.", readiness }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    qty?: number | string;
    limitPrice?: number | string;
    timeInForce?: string;
    acknowledgement?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ ok: false, mode, error: "Order replacement payload is required." }, { status: 400 });
  }
  if (mode === "live" && !truthyConfirmation(body.acknowledgement, cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK))) {
    return NextResponse.json({ ok: false, mode, error: "Live execution acknowledgement did not match." }, { status: 400 });
  }

  const replacement: Record<string, unknown> = {};
  if (body.qty !== undefined) replacement.qty = String(body.qty);
  if (body.limitPrice !== undefined) replacement.limit_price = String(body.limitPrice);
  if (body.timeInForce) replacement.time_in_force = body.timeInForce;
  if (Object.keys(replacement).length === 0) {
    return NextResponse.json({ ok: false, mode, error: "Provide qty, limitPrice, or timeInForce to replace." }, { status: 400 });
  }

  try {
    const existingOrder = await getBrokerOrder(id, mode);
    const candidate = buildReplacementOrderPayload(existingOrder, body);
    const validation = validateBrokerOrderPayload(candidate, brokerConfig(mode));
    if (!validation.ok) {
      return NextResponse.json({ ok: false, mode, error: validation.error, readiness }, { status: 400 });
    }
    const preTrade = await evaluatePreTradeControls({ mode, order: validation.order });
    if (!preTrade.ok) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          error: "Pre-trade controls blocked this order replacement.",
          blockers: preTrade.blockers,
          warnings: preTrade.warnings,
          controlState: preTrade.state,
        },
        { status: 409 },
      );
    }
    const order = await replaceBrokerOrder(id, replacement, mode);
    return NextResponse.json({ ok: true, mode, order });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker order replacement failed.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to cancel broker orders." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.executionEnabled || !readiness.credentialsConfigured) {
    return NextResponse.json({ ok: false, mode, error: "Broker execution is not ready.", readiness }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { acknowledgement?: string } | null;
  if (mode === "live" && !truthyConfirmation(body?.acknowledgement, cleanSecret(process.env.BROKER_LIVE_EXECUTION_ACK))) {
    return NextResponse.json({ ok: false, mode, error: "Live execution acknowledgement did not match." }, { status: 400 });
  }

  try {
    const { id } = await params;
    const order = await cancelBrokerOrder(id, mode);
    return NextResponse.json({ ok: true, mode, order });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker order cancellation failed.");
  }
}
