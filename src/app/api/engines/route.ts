import { NextResponse } from "next/server";
import { engineCapabilities, engineWorkflow } from "@/lib/engineCatalog";

export function GET() {
  return NextResponse.json({
    engines: engineCapabilities,
    workflow: engineWorkflow,
    liveTradingEnabled: false,
    guardrail: "Research and paper-trading workflows only until broker, compliance, and risk gates are explicitly configured.",
  });
}
