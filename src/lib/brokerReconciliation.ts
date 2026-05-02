import {
  getAccountActivities,
  insertBrokerOrderEvent,
  listBrokerOrders,
  type BrokerMode,
} from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { insertBrokerReconciliation } from "@/lib/persistence";

export async function reconcileBrokerState({ mode }: { mode: BrokerMode }) {
  const [orders, activities] = await Promise.all([
    listBrokerOrders({ mode, status: "all", limit: 100 }),
    getAccountActivities(mode, "direction=desc&page_size=100"),
  ]);

  let eventsInserted = 0;
  if (databaseConfigured()) {
    for (const order of orders.slice(0, 100)) {
      await insertBrokerOrderEvent({
        mode,
        brokerOrderId: text(order, "id"),
        clientOrderId: text(order, "client_order_id"),
        symbol: text(order, "symbol"),
        eventType: `reconcile.order.${text(order, "status") || "unknown"}`,
        brokerStatus: text(order, "status"),
        payload: order,
      }).then(() => {
        eventsInserted += 1;
      }).catch(() => null);
    }
    for (const activity of activities.slice(0, 100)) {
      await insertBrokerOrderEvent({
        mode,
        brokerOrderId: text(activity, "order_id"),
        symbol: text(activity, "symbol"),
        eventType: `reconcile.activity.${text(activity, "activity_type") || text(activity, "type") || "unknown"}`,
        brokerStatus: text(activity, "side"),
        payload: activity,
      }).then(() => {
        eventsInserted += 1;
      }).catch(() => null);
    }
  }

  const summary = {
    ordersByStatus: bucketBy(orders, "status"),
    activitiesByType: bucketBy(activities, "activity_type"),
    streamEndpoint: mode === "live" ? "wss://api.alpaca.markets/stream" : "wss://paper-api.alpaca.markets/stream",
    streamName: "trade_updates",
    streamNote: "For real-time order state, run a persistent worker outside Vercel Functions and store trade_updates events.",
  };
  const storedRun =
    databaseConfigured()
      ? await insertBrokerReconciliation({
          mode,
          ordersChecked: orders.length,
          activitiesChecked: activities.length,
          eventsInserted,
          status: "completed",
          summary,
        }).catch((error) => ({ error: error instanceof Error ? error.message : "Reconciliation storage failed." }))
      : null;

  return {
    ok: true,
    mode,
    ordersChecked: orders.length,
    activitiesChecked: activities.length,
    eventsInserted,
    summary,
    storedRun,
  };
}

function bucketBy(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = text(row, key) || "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
