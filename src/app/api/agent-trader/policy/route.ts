import { NextResponse } from "next/server";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { buildAgentTradingPolicy } from "@/lib/agentTrader";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const mode = modeFromRequest(request);
  return NextResponse.json({
    ok: true,
    mode,
    policy: buildAgentTradingPolicy(mode),
    advisory:
      "Agents can submit paper orders when Alpaca paper execution is ready. Live-money agent autonomy remains blocked; mirror paper fills manually if you choose.",
  });
}
