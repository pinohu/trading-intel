import { NextResponse } from "next/server";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { buildAgentTradingPolicy } from "@/lib/agentTrader";
import { brokerReadiness } from "@/lib/broker";
import { getTradingControlState } from "@/lib/executionControl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const [controls, liveReadiness] = await Promise.all([
    getTradingControlState(),
    brokerReadiness("live"),
  ]);
  const policy = buildAgentTradingPolicy(mode, {
    controls,
    liveOrderPlacementReady: liveReadiness.orderPlacementReady,
  });
  return NextResponse.json({
    ok: true,
    mode,
    policy,
    advisory:
      policy.liveAutonomyAllowed
        ? "Live-money agent execution is armed for logged-in operator-triggered requests with the live acknowledgement phrase."
        : "Agents can submit paper orders when Alpaca paper execution is ready. Live-money agent execution stays locked until you arm the live-agent gates.",
  });
}
