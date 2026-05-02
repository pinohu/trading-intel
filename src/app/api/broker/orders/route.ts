import { NextResponse } from "next/server";
import { brokerOrderToAitableRecord, safeMirrorAitableRecords } from "@/lib/aitable";
import {
  brokerConfig,
  brokerReadiness,
  createBrokerOrderAudit,
  insertBrokerOrderEvent,
  listBrokerOrders,
  submitAlpacaOrder,
  updateBrokerOrderAudit,
  validateBrokerOrderPayload,
} from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials, safeLimit } from "@/lib/brokerRoutes";
import { evaluatePreTradeControls } from "@/lib/executionControl";
import { hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { readiness, response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const orders = await listBrokerOrders({
      mode,
      status: searchParams.get("status") ?? "open",
      limit: safeLimit(searchParams.get("limit"), 50, 500),
    });
    return NextResponse.json({ ok: true, mode: readiness.mode, orders });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker order list failed.");
  }
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to place broker orders." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.orderPlacementReady) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: mode === "live" ? "Live broker execution is locked." : "Broker execution is not ready.",
        readiness,
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const validation = validateBrokerOrderPayload(body, brokerConfig(mode));
  if (!validation.ok) {
    return NextResponse.json({ ok: false, mode, error: validation.error, readiness }, { status: 400 });
  }
  const preTrade = await evaluatePreTradeControls({ mode, order: validation.order });
  if (!preTrade.ok) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: "Pre-trade controls blocked this order.",
        blockers: preTrade.blockers,
        warnings: preTrade.warnings,
        controlState: preTrade.state,
      },
      { status: 409 },
    );
  }

  let auditId: string | null = null;
  if (mode === "live") {
    try {
      auditId = await createBrokerOrderAudit(validation.order, mode);
    } catch {
      return NextResponse.json({ ok: false, mode, error: "Live order audit storage is unavailable." }, { status: 503 });
    }
  }

  try {
    const brokerOrder = await submitAlpacaOrder(validation.order, mode);
    if (auditId) {
      await updateBrokerOrderAudit(auditId, "submitted", brokerOrder);
    }
    await insertBrokerOrderEvent({
      auditId,
      mode,
      brokerOrderId: brokerOrder?.id ? String(brokerOrder.id) : null,
      clientOrderId: validation.order.clientOrderId,
      symbol: validation.order.symbol,
      eventType: "submitted",
      brokerStatus: brokerOrder?.status ? String(brokerOrder.status) : null,
      payload: brokerOrder,
    }).catch(() => null);
    const aitableMirror = await safeMirrorAitableRecords("brokerOrders", [
      brokerOrderToAitableRecord({
        mode,
        order: validation.order,
        status: "submitted",
        brokerResponse: brokerOrder,
      }),
    ]);
    return NextResponse.json(
      {
        ok: true,
        mode,
        liveMoney: mode === "live",
        brokerOrder,
        auditId,
        aitableMirror,
      },
      { status: 201 },
    );
  } catch (error) {
    if (auditId) {
      await updateBrokerOrderAudit(auditId, "rejected", { error: error instanceof Error ? error.message : "Broker order failed." });
    }
    await insertBrokerOrderEvent({
      auditId,
      mode,
      clientOrderId: validation.order.clientOrderId,
      symbol: validation.order.symbol,
      eventType: "rejected",
      brokerStatus: "rejected",
      payload: { error: error instanceof Error ? error.message : "Broker order failed." },
    }).catch(() => null);
    await safeMirrorAitableRecords("brokerOrders", [
      brokerOrderToAitableRecord({
        mode,
        order: validation.order,
        status: "rejected",
        brokerResponse: { error: error instanceof Error ? error.message : "Broker order failed." },
      }),
    ]);
    return brokerUpstreamError(error, mode, "Broker order failed.");
  }
}
