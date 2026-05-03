import { NextResponse } from "next/server";
import { brokerConfig, validateBrokerOrderPayload } from "@/lib/broker";
import { modeFromRequest } from "@/lib/brokerRoutes";
import { evaluatePreTradeControls } from "@/lib/executionControl";
import { buildOrchestrationRun, listOrchestrationRuns, storeOrchestrationRun } from "@/lib/orchestration";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { cleanSecret, hasValidUserSession } from "@/lib/security";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

type FusionAlphaPayload = {
  ok?: boolean;
  predictions?: Parameters<typeof buildOrchestrationRun>[0]["predictions"];
  raw?: {
    backtest?: {
      results?: Parameters<typeof buildOrchestrationRun>[0]["backtestResults"];
    } | null;
  };
  error?: string;
};

type AgentTraderPayload = {
  ok?: boolean;
  policy?: Parameters<typeof buildOrchestrationRun>[0]["policy"];
  proposals?: Parameters<typeof buildOrchestrationRun>[0]["proposals"];
  error?: string;
};

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-cron-secret");
  return hasValidUserSession(request) || Boolean(cronSecret && (bearer === cronSecret || headerSecret === cronSecret));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "A user session or cron secret is required to view control-plane runs." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseNumberParam(url.searchParams.get("limit"), 5, 1, 25);
  const runs = await listOrchestrationRuns(limit);
  return NextResponse.json({
    ok: true,
    source: "control-plane-v1",
    latest: runs[0] ?? null,
    runs,
    advisory: "Control-plane runs coordinate research, thesis, backtest, risk review, paper execution, and manual live gating.",
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "A user session or cron secret is required to start a control-plane run." }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    symbols?: string;
    provider?: string;
    accountSize?: number;
    riskPct?: number;
    maxDailyLossPct?: number;
    lookbackDays?: number;
  };
  const mode = modeFromRequest(request);
  const symbols = parseSymbols(body.symbols ?? url.searchParams.get("symbols"), 8);
  const provider = parseProvider(body.provider ?? url.searchParams.get("provider"));
  const accountSize = parseNumberParam(numberParam(body.accountSize, url.searchParams.get("accountSize")), 10000, 100, 100000000);
  const riskPct = parseNumberParam(numberParam(body.riskPct, url.searchParams.get("riskPct")), 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(numberParam(body.maxDailyLossPct, url.searchParams.get("maxDailyLossPct")), 3, 0.1, 20);
  const lookbackDays = Math.round(parseNumberParam(numberParam(body.lookbackDays, url.searchParams.get("lookbackDays")), 180, 60, 365));

  const headers = forwardHeaders(request);
  const fusionUrl = new URL("/api/fusion-alpha", url.origin);
  fusionUrl.searchParams.set("mode", mode);
  fusionUrl.searchParams.set("symbols", symbolsParam(symbols));
  fusionUrl.searchParams.set("provider", provider);
  fusionUrl.searchParams.set("lookbackDays", String(lookbackDays));
  fusionUrl.searchParams.set("accountSize", String(accountSize));
  fusionUrl.searchParams.set("riskPct", String(riskPct));
  fusionUrl.searchParams.set("maxDailyLossPct", String(maxDailyLossPct));
  fusionUrl.searchParams.set("depth", "standard");

  const proposalsUrl = new URL("/api/agent-trader/proposals", url.origin);
  proposalsUrl.searchParams.set("mode", mode);
  proposalsUrl.searchParams.set("symbols", symbolsParam(symbols));
  proposalsUrl.searchParams.set("provider", provider);
  proposalsUrl.searchParams.set("accountSize", String(accountSize));
  proposalsUrl.searchParams.set("riskPct", String(riskPct));
  proposalsUrl.searchParams.set("maxDailyLossPct", String(maxDailyLossPct));

  const [fusionResponse, proposalsResponse] = await Promise.all([
    fetch(fusionUrl, { cache: "no-store", headers }),
    fetch(proposalsUrl, { cache: "no-store", headers }),
  ]);
  const fusion = (await fusionResponse.json().catch(() => ({ ok: false, error: "Fusion Alpha did not return JSON." }))) as FusionAlphaPayload;
  const agent = (await proposalsResponse.json().catch(() => ({ ok: false, error: "Agent proposals did not return JSON." }))) as AgentTraderPayload;
  const predictions = fusion.predictions ?? [];
  const proposals = agent.proposals ?? [];
  const primaryPrediction = predictions.find((item) => item.direction === "buy" && item.action !== "Data Review") ?? predictions[0];
  const proposal = primaryPrediction ? proposals.find((item) => item.symbol === primaryPrediction.symbol) : proposals[0];
  const validation = proposal ? validateBrokerOrderPayload(proposal.orderDraft, brokerConfig("paper")) : null;
  const paperPreTrade = validation?.ok ? await evaluatePreTradeControls({ mode: "paper", order: validation.order }) : null;
  const run = buildOrchestrationRun({
    mode,
    provider,
    symbols,
    predictions,
    proposals,
    policy: agent.policy ?? null,
    paperPreTrade,
    validatedPaperOrder: validation?.ok ? validation.order : null,
    backtestResults: fusion.raw?.backtest?.results ?? [],
  });
  const stored = await storeOrchestrationRun(run);

  await recordAuditEvent("control_plane.run_created", null, {
    runId: run.id,
    mode,
    status: run.status,
    symbol: run.decision.symbol,
    symbols: symbols.join(","),
  });

  return NextResponse.json(
    {
      ok: fusionResponse.ok && run.status !== "blocked",
      source: "control-plane-v1",
      run,
      stored: stored.stored,
      upstream: {
        fusionAlpha: fusionResponse.ok,
        proposals: proposalsResponse.ok,
        fusionError: fusion.error,
        proposalError: agent.error,
      },
      advisory: "Paper execution may be automated only after risk approval. Live execution remains manual and cannot be triggered by this run.",
    },
    { status: fusionResponse.ok ? 201 : fusionResponse.status },
  );
}

function forwardHeaders(request: Request) {
  const headers = new Headers();
  copyHeader(request, headers, "cookie");
  copyHeader(request, headers, "authorization");
  copyHeader(request, headers, "x-cron-secret");
  return headers;
}

function copyHeader(request: Request, headers: Headers, name: string) {
  const value = request.headers.get(name);
  if (value) headers.set(name, value);
}

function numberParam(value: number | undefined, fallback: string | null) {
  return value === undefined ? fallback : String(value);
}
