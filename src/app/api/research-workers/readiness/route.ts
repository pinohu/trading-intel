import { NextResponse } from "next/server";
import { externalWorkerReadiness } from "@/lib/externalWorkers";

export const dynamic = "force-dynamic";

export function GET() {
  const workers = externalWorkerReadiness();
  return NextResponse.json({
    ok: true,
    configured: workers.filter((worker) => worker.configured).length,
    total: workers.length,
    workers,
    note: "These workers are external by design. Vercel should orchestrate them, not host heavyweight quant/RL engines directly.",
  });
}
