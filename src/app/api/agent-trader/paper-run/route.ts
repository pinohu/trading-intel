import { NextResponse } from "next/server";
import { parseNumberParam, parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { cleanSecret } from "@/lib/security";

export const dynamic = "force-dynamic";

const defaultPaperSymbols = "SPY,QQQ,NVDA,TSLA,AAPL,MSFT,AMD,COIN,GLD,SLV,USO,UNG";

function authorized(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  if (!cronSecret) return false;
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerSecret === cronSecret || bearer === cronSecret;
}

export async function GET(request: Request) {
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  if (!authorized(request) || !cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized agent paper run." }, { status: 401 });
  }

  const url = new URL(request.url);
  const executeUrl = new URL("/api/agent-trader/execute", url.origin);
  executeUrl.searchParams.set("mode", "paper");

  const symbols = parseSymbols(url.searchParams.get("symbols") ?? process.env.AGENT_PAPER_SYMBOLS ?? process.env.MONITOR_WATCHLIST ?? defaultPaperSymbols, 24);
  const provider = parseProvider(url.searchParams.get("provider"));
  const accountSize = parseNumberParam(url.searchParams.get("accountSize") ?? process.env.AGENT_PAPER_ACCOUNT_SIZE, 10000, 100, 100000000);
  const riskPct = parseNumberParam(url.searchParams.get("riskPct") ?? process.env.AGENT_PAPER_RISK_PCT, 1, 0, 5);
  const maxDailyLossPct = parseNumberParam(url.searchParams.get("maxDailyLossPct") ?? process.env.AGENT_PAPER_MAX_DAILY_LOSS_PCT, 3, 0.1, 20);

  const response = await fetch(executeUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      symbols: symbolsParam(symbols),
      provider,
      accountSize,
      riskPct,
      maxDailyLossPct,
    }),
    cache: "no-store",
  });
  const execution = await response.json().catch(() => ({
    ok: false,
    error: "Agent paper execution returned a non-JSON response.",
  }));

  return NextResponse.json({
    ok: execution.ok === true,
    ranAt: new Date().toISOString(),
    executionStatus: response.status,
    execution,
  });
}
