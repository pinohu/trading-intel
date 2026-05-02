import { NextResponse } from "next/server";
import {
  brokerReadiness,
  getAccountActivities,
  getBrokerAccount,
  getBrokerPositions,
  getMarketCalendar,
  getMarketClock,
  getPortfolioHistory,
  listBrokerOrders,
} from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  if (!readiness.credentialsConfigured) {
    return NextResponse.json({ ok: false, mode, readiness, error: `${mode} Alpaca credentials are not configured.` }, { status: 503 });
  }

  const [account, positions, orders, portfolioHistory, activities, clock, calendar] = await Promise.allSettled([
    getBrokerAccount(mode),
    getBrokerPositions(mode),
    listBrokerOrders({ mode, status: "open", limit: 50 }),
    getPortfolioHistory(mode, "period=1M&timeframe=1D&intraday_reporting=extended_hours"),
    getAccountActivities(mode, "direction=desc&page_size=25"),
    getMarketClock(mode),
    getMarketCalendar(mode, nextCalendarQuery()),
  ]);

  return NextResponse.json({
    ok: true,
    mode,
    readiness,
    account: settledValue(account),
    positions: settledValue(positions) ?? [],
    orders: settledValue(orders) ?? [],
    portfolioHistory: settledValue(portfolioHistory),
    activities: settledValue(activities) ?? [],
    clock: settledValue(clock),
    calendar: settledValue(calendar) ?? [],
    errors: {
      account: settledError(account),
      positions: settledError(positions),
      orders: settledError(orders),
      portfolioHistory: settledError(portfolioHistory),
      activities: settledError(activities),
      clock: settledError(clock),
      calendar: settledError(calendar),
    },
  });
}

function nextCalendarQuery() {
  const start = new Date();
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 14);
  return `start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`;
}

function settledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}

function settledError<T>(result: PromiseSettledResult<T>) {
  return result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : "Request failed") : null;
}
