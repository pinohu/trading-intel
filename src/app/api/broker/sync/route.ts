import { NextResponse } from "next/server";
import { getBrokerPositions, insertBrokerOrderEvent, listBrokerOrders } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const mode = modeFromRequest(request);
  const limit = parseNumberParam(url.searchParams.get("limit"), 100, 1, 500);
  const { readiness, response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const [openOrders, closedOrders, positions] = await Promise.all([
      listBrokerOrders({ mode, status: "open", limit }),
      listBrokerOrders({ mode, status: "closed", limit }),
      getBrokerPositions(mode),
    ]);
    const orders = [...openOrders, ...closedOrders];
    const stored = await Promise.allSettled(
      orders.slice(0, limit).map((order) =>
        insertBrokerOrderEvent({
          mode,
          brokerOrderId: textField(order, "id"),
          clientOrderId: textField(order, "client_order_id"),
          symbol: textField(order, "symbol"),
          eventType: "broker_sync",
          brokerStatus: textField(order, "status"),
          payload: order,
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      mode,
      readiness,
      openOrders: openOrders.length,
      closedOrders: closedOrders.length,
      positions: positions.length,
      storedEvents: stored.filter((item) => item.status === "fulfilled").length,
      storageErrors: stored.filter((item) => item.status === "rejected").length,
    });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker lifecycle sync failed.");
  }
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}
