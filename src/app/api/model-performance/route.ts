import { NextResponse } from "next/server";
import { databaseConfigured, databaseUnavailableResponse } from "@/lib/db";
import { modelPerformanceSummary } from "@/lib/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({
      ...databaseUnavailableResponse(),
      summary: {
        totalSignals: 0,
        buyWatchSignals: 0,
        sellWatchSignals: 0,
        freshSignals: 0,
        avgConfidence: null,
        avgRewardRisk: null,
      },
      outcomes: [],
    }, { status: 503 });
  }

  try {
    const performance = await modelPerformanceSummary();
    return NextResponse.json({ ok: true, ...performance });
  } catch {
    return NextResponse.json({ ok: false, error: "Model performance storage is unavailable" }, { status: 503 });
  }
}
