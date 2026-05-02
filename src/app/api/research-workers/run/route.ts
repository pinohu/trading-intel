import { NextResponse } from "next/server";
import { runExternalWorkerJob, validExternalWorkerJob, validWorkerKey } from "@/lib/externalWorkers";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized worker request." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { worker?: unknown; job?: unknown } | null;
  if (!payload || !validWorkerKey(payload.worker) || !validExternalWorkerJob(payload.job)) {
    return NextResponse.json({ ok: false, error: "Invalid worker job payload." }, { status: 400 });
  }

  try {
    const result = await runExternalWorkerJob(payload.worker, payload.job);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Worker job failed." },
      { status: 503 },
    );
  }
}
