import { NextResponse } from "next/server";
import { recentBacktests, runMomentumBreakoutBacktest } from "@/lib/backtesting";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { parseNumberParam, parseSymbols } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const history = url.searchParams.get("history") === "true";
  const limit = parseNumberParam(url.searchParams.get("limit"), 25, 1, 100);
  if (history) {
    const runs = await recentBacktests(limit);
    return NextResponse.json({ ok: true, runs });
  }

  const mode = modeFromRequest(request);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 12);
  const lookbackDays = Math.round(parseNumberParam(url.searchParams.get("lookbackDays"), 180, 45, 1000));
  const slippageBps = parseNumberParam(url.searchParams.get("slippageBps"), 5, 0, 100);
  const feeBps = parseNumberParam(url.searchParams.get("feeBps"), 1, 0, 100);
  const maxHoldBars = Math.round(parseNumberParam(url.searchParams.get("maxHoldBars"), 5, 1, 30));
  const stopPct = parseNumberParam(url.searchParams.get("stopPct"), 2, 0.1, 25);
  const rewardRisk = parseNumberParam(url.searchParams.get("rewardRisk"), 2, 0.5, 10);

  try {
    const result = await runMomentumBreakoutBacktest({
      symbols,
      lookbackDays,
      mode,
      slippageBps,
      feeBps,
      maxHoldBars,
      stopPct,
      rewardRisk,
    });
    return NextResponse.json({
      ok: true,
      mode,
      ...result,
      advisory:
        "Backtests are historical evidence only. They include simple slippage/fee assumptions and do not prove future profits.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, mode, error: error instanceof Error ? error.message : "Backtest failed." },
      { status: 503 },
    );
  }
}
