import { NextResponse } from "next/server";
import { parseNumberParam } from "@/lib/requestGuards";
import { loadStrategyPortfolio } from "@/lib/strategyPortfolio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.round(parseNumberParam(url.searchParams.get("limit"), 50, 1, 200));
  try {
    const portfolio = await loadStrategyPortfolio(limit);
    return NextResponse.json(portfolio);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Strategy portfolio unavailable." },
      { status: 503 },
    );
  }
}
