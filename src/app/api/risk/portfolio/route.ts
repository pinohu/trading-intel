import { NextResponse } from "next/server";
import { getBrokerAccount, getBrokerPositions, listBrokerOrders } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";
import { parseNumberParam } from "@/lib/requestGuards";
import { buildPortfolioRiskReport, recentPortfolioRiskSnapshots, storePortfolioRiskReport } from "@/lib/riskEngine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = modeFromRequest(request);
  const history = url.searchParams.get("history") === "true";
  const limit = parseNumberParam(url.searchParams.get("limit"), 25, 1, 100);
  if (history) {
    const snapshots = await recentPortfolioRiskSnapshots(limit);
    return NextResponse.json({ ok: true, mode, snapshots });
  }

  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct"), 3, 0.1, 20);
  const { readiness, response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const [account, positions, orders] = await Promise.all([
      getBrokerAccount(mode),
      getBrokerPositions(mode),
      listBrokerOrders({ mode, status: "open", limit: 100 }),
    ]);
    const report = buildPortfolioRiskReport({ mode, account, positions, orders, maxDailyLossPct });
    const storedSnapshot = await storePortfolioRiskReport({ report, account, positions, orders }).catch((error) => ({
      error: error instanceof Error ? error.message : "Risk snapshot storage failed.",
    }));
    return NextResponse.json({ ok: true, mode, readiness, report: { ...report, storedSnapshot } });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Portfolio risk sync failed.");
  }
}
