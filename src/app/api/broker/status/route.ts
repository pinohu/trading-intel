import { NextResponse } from "next/server";
import { allBrokerReadiness, brokerReadiness, parseBrokerMode } from "@/lib/broker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("mode")?.trim().toLowerCase() === "both") {
    const readiness = await allBrokerReadiness();
    return NextResponse.json({
      ok: true,
      provider: "alpaca",
      paper: serializeReadiness(readiness.paper),
      live: serializeReadiness(readiness.live),
    });
  }

  const readiness = await brokerReadiness(parseBrokerMode(searchParams.get("mode")));
  return NextResponse.json({
    ok: true,
    ...serializeReadiness(readiness),
  });
}

function serializeReadiness(readiness: Awaited<ReturnType<typeof brokerReadiness>>) {
  return {
    provider: readiness.provider,
    mode: readiness.mode,
    executionEnabled: readiness.executionEnabled,
    credentialsConfigured: readiness.credentialsConfigured,
    liveTradingEnabled: readiness.liveTradingEnabled,
    liveAckConfigured: readiness.liveAckConfigured,
    orderPlacementReady: readiness.orderPlacementReady,
    liveAuditReady: readiness.liveAuditReady,
    maxOrderNotional: readiness.maxOrderNotional,
    maxOrderUnits: readiness.maxOrderUnits,
    allowExtendedHours: readiness.allowExtendedHours,
    dataQuality: readiness.dataQuality,
    missing: readiness.missing,
    restrictions: readiness.restrictions,
    database: {
      configured: readiness.database.configured,
      reachable: readiness.database.reachable,
      schemaReady: readiness.database.schemaReady,
    },
  };
}
