import { NextResponse } from "next/server";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { autoResearchCandidates, recentAutoResearchRuns, runAutoResearchLab } from "@/lib/autoresearchLab";
import { parseNumberParam, parseSymbols } from "@/lib/requestGuards";
import { cleanSecret, hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 10, 1, 50);
  const runs = await recentAutoResearchRuns(limit).catch(() => []);
  return NextResponse.json({
    ok: true,
    candidates: autoResearchCandidates,
    recentRuns: runs,
    guardrail: "AutoResearch is research-only. It can propose strategy variants, but promotion requires paper-trading proof and risk controls.",
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized AutoResearch request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    symbols?: string;
    lookbackDays?: number;
    budget?: number;
  };
  const symbols = parseSymbols(body.symbols ?? url.searchParams.get("symbols"), 8);
  const lookbackValue = body.lookbackDays === undefined ? url.searchParams.get("lookbackDays") : String(body.lookbackDays);
  const budgetValue = body.budget === undefined ? url.searchParams.get("budget") : String(body.budget);
  const lookbackDays = Math.round(parseNumberParam(lookbackValue, 180, 60, 1000));
  const budget = Math.round(parseNumberParam(budgetValue, 3, 1, 5));
  const mode = modeFromRequest(request);

  try {
    const result = await runAutoResearchLab({
      symbols,
      lookbackDays,
      budget,
      mode,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "AutoResearch lab failed." },
      { status: 503 },
    );
  }
}
