import { NextResponse } from "next/server";
import { trustBuildOrder, trustOperationGaps, trustSummary } from "@/lib/trustOperations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    asOf: new Date().toISOString(),
    thesis: "The biggest gap is not more tickers. It is proof.",
    proofQuestion: "When this exact signal appears, after slippage and fees, over many past market conditions, does it have a durable edge?",
    summary: trustSummary(),
    buildOrder: trustBuildOrder,
    gaps: trustOperationGaps,
  });
}
