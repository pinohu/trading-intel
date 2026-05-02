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
      "Agents can assist with research, paper trading, and order drafting. Live-money agent autonomy is intentionally blocked.",
  });
}
