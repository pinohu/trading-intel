import { NextResponse } from "next/server";
import { getPortfolioHistory } from "@/lib/broker";
import { brokerUpstreamError, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const query = passthroughQuery(searchParams) || "period=1M&timeframe=1D&intraday_reporting=extended_hours";
    const portfolioHistory = await getPortfolioHistory(mode, query);
    return NextResponse.json({ ok: true, mode, portfolioHistory });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker portfolio history request failed.");
  }
}
