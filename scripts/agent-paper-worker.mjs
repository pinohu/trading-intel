const baseUrl = process.env.TRADING_APP_URL || "https://trading-intel-platform.vercel.app";
const cronSecret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.AGENT_PAPER_WORKER_INTERVAL_MS || 60000);
const symbols = process.env.AGENT_PAPER_SYMBOLS || process.env.MONITOR_WATCHLIST || "SPY,QQQ,NVDA,TSLA,AAPL,MSFT,AMD,COIN";
const accountSize = Number(process.env.AGENT_PAPER_ACCOUNT_SIZE || 10000);
const riskPct = Number(process.env.AGENT_PAPER_RISK_PCT || 1);
const maxDailyLossPct = Number(process.env.AGENT_PAPER_MAX_DAILY_LOSS_PCT || 3);

if (!cronSecret) {
  throw new Error("CRON_SECRET is required for scripts/agent-paper-worker.mjs");
}

async function tick() {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/agent-trader/execute?mode=paper`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      symbols,
      accountSize,
      riskPct,
      maxDailyLossPct,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const summary = {
    ranAt: new Date().toISOString(),
    status: response.status,
    ok: payload.ok === true,
    symbol: payload.proposal?.symbol ?? null,
    brokerStatus: payload.brokerOrder?.status ?? null,
    error: payload.error ?? null,
  };
  console.log(JSON.stringify(summary));
}

await tick();

if (process.env.AGENT_PAPER_WORKER_LOOP === "false") {
  process.exit(0);
}

setInterval(() => {
  tick().catch((error) => {
    console.error(JSON.stringify({ ranAt: new Date().toISOString(), ok: false, error: error.message }));
  });
}, Math.max(15000, Number.isFinite(intervalMs) ? intervalMs : 60000));
