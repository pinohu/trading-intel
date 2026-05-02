import { NextResponse } from "next/server";
import { buildWorkerReadiness } from "@/lib/workerReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildWorkerReadiness());
}
