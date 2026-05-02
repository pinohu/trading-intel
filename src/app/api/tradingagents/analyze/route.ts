import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { databaseConfigured } from "@/lib/db";
import { runExternalWorkerJob } from "@/lib/externalWorkers";
import { insertResearchNote } from "@/lib/persistence";
import { cleanSecret, hasValidUserSession } from "@/lib/security";
import {
  cleanTradingAgentsDate,
  formatTradingAgentsNote,
  normalizeTradingAgentsDecisions,
  parseTradingAgentsSymbols,
  validTradingAgentsDepth,
  type TradingAgentsDepth,
} from "@/lib/tradingAgents";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized TradingAgents request." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    symbols?: unknown;
    analysisDate?: unknown;
    depth?: unknown;
    provider?: unknown;
  } | null;
  const symbols = parseTradingAgentsSymbols(payload?.symbols);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, error: "Provide 1-8 valid symbols." }, { status: 400 });
  }

  const analysisDate = cleanTradingAgentsDate(payload?.analysisDate);
  const depth: TradingAgentsDepth = validTradingAgentsDepth(payload?.depth) ? payload.depth : "standard";
  const provider = typeof payload?.provider === "string" && payload.provider.length <= 40 ? payload.provider : undefined;

  try {
    const workerResult = await runExternalWorkerJob("tradingagents", {
      jobType: "agent-debate",
      symbols,
      strategy: "multi-agent trading research debate",
      parameters: {
        analysisDate,
        depth,
        provider,
        maxDebateRounds: depth === "deep" ? 3 : depth === "standard" ? 2 : 1,
        outputContract: "Return decisions with symbol, rating/recommendation, thesis, risks, and portfolioDecision.",
      },
    });
    const decisions = normalizeTradingAgentsDecisions(workerResult.data, symbols);
    const persistedNotes = await persistTradingAgentsNotes(decisions, analysisDate, depth);

    await recordAuditEvent("tradingagents.analyze", null, {
      symbols: symbols.join(","),
      analysisDate,
      depth,
      persistedNotes: persistedNotes.length,
    });

    return NextResponse.json({
      ok: true,
      source: "tradingagents",
      requested: { symbols, analysisDate, depth },
      decisions,
      persistedNotes,
      raw: workerResult.data,
      advisory: "TradingAgents output is research-only. Broker execution remains blocked behind the existing paper/live gates.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "TradingAgents analysis failed." },
      { status: 503 },
    );
  }
}

async function persistTradingAgentsNotes(
  decisions: ReturnType<typeof normalizeTradingAgentsDecisions>,
  analysisDate: string,
  depth: TradingAgentsDepth,
) {
  if (!databaseConfigured()) return [];
  const inserted = [];
  for (const decision of decisions) {
    const note = await insertResearchNote({
      symbol: decision.symbol,
      noteType: "tradingagents",
      title: `TradingAgents ${decision.rating}: ${decision.symbol}`,
      body: formatTradingAgentsNote(decision, analysisDate, depth),
      tags: ["tradingagents", "multi-agent", "research-only", depth],
      source: "tradingagents-worker",
    });
    inserted.push(note);
  }
  return inserted;
}
