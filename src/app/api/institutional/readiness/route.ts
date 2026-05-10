import { NextResponse } from "next/server";
import { buildComplianceReadiness } from "@/lib/compliance";
import { getTradingControlState } from "@/lib/executionControl";
import { buildFinancialServicesReadiness } from "@/lib/financialServicesWorkflows";
import { buildValidationReport } from "@/lib/validationEngine";
import { buildWorkerReadiness } from "@/lib/workerReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const [proof, controls] = await Promise.all([
    buildValidationReport(),
    getTradingControlState(),
  ]);
  const workers = buildWorkerReadiness();
  const compliance = buildComplianceReadiness();
  const financialServices = buildFinancialServicesReadiness();
  const passed =
    proof.grade !== "red" &&
    !controls.killSwitch &&
    workers.grade !== "missing" &&
    compliance.grade !== "blocked";

  return NextResponse.json({
    ok: true,
    productionInstitutionalReady: passed,
    proof,
    controls,
    workers,
    compliance,
    financialServices,
    missing: [
      proof.grade === "red" ? "Proof validation has failed gates." : "",
      controls.killSwitch ? "Trading kill switch is active." : "",
      workers.grade === "missing" ? "Persistent worker infrastructure is not enabled." : "",
      compliance.grade === "blocked" ? "Compliance boundary is blocked." : "",
    ].filter(Boolean),
  });
}
