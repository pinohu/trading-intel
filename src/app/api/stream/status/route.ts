import { NextResponse } from "next/server";
import { brokerReadiness, getMarketClock } from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const readiness = await brokerReadiness(mode);
  const clock = readiness.credentialsConfigured
    ? await getMarketClock(mode).catch((error) => ({ error: error instanceof Error ? error.message : "Market clock unavailable." }))
    : null;

  return NextResponse.json({
    ok: true,
    mode,
    generatedAt: new Date().toISOString(),
    serverlessMode: "polling",
    browserRefreshSeconds: 15,
    brokerTradingStreamAvailable: readiness.credentialsConfigured,
    marketDataStreamAvailable: readiness.credentialsConfigured,
    streamEndpoints: {
      marketData: "wss://stream.data.alpaca.markets/v2/iex",
      tradingAccount: mode === "live" ? "wss://api.alpaca.markets/stream" : "wss://paper-api.alpaca.markets/stream",
    },
    implementationNote:
      "Vercel functions do not run a durable always-on websocket worker. This app uses fast polling in the dashboard and cron; a dedicated worker can attach to these Alpaca streams later without changing the API contract.",
    readiness,
    clock,
  });
}
