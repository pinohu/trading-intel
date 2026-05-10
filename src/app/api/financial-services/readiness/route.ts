import { NextResponse } from "next/server";
import { buildFinancialServicesReadiness } from "@/lib/financialServicesWorkflows";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildFinancialServicesReadiness());
}
