import { NextResponse } from "next/server";
import { buildResearchStackReadiness } from "@/lib/researchStack";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildResearchStackReadiness());
}
