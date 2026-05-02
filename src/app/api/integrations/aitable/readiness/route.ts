import { NextResponse } from "next/server";
import { aitableReadiness, listAitableSpaces } from "@/lib/aitable";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = aitableReadiness();
  let spacesReachable = false;
  let spacesError: string | null = null;

  if (readiness.apiKeyConfigured) {
    try {
      await listAitableSpaces();
      spacesReachable = true;
    } catch (error) {
      spacesError = error instanceof Error ? error.message : "AITable spaces check failed.";
    }
  }

  return NextResponse.json({
    ok: true,
    ...readiness,
    spacesReachable,
    spacesError,
  });
}
