import { NextResponse } from "next/server";
import { buildComplianceReadiness } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildComplianceReadiness());
}
