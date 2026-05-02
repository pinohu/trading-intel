import { NextResponse } from "next/server";
import { buildValidationReport } from "@/lib/validationEngine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const persist = url.searchParams.get("persist") === "true";
  const report = await buildValidationReport({ persist });
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
