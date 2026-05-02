const appUrl = process.env.TRADING_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const worker = process.env.RESEARCH_WORKER || "vectorbt";
const jobType = process.env.RESEARCH_JOB_TYPE || "parameter-sweep";
const symbols = (process.env.RESEARCH_SYMBOLS || "SPY,QQQ,NVDA,TSLA").split(",").map((symbol) => symbol.trim().toUpperCase());

if (!secret) {
  console.error("CRON_SECRET is required for scripts/research-worker-dispatch.mjs");
  process.exit(1);
}

const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/research-workers/run`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-cron-secret": secret,
  },
  body: JSON.stringify({
    worker,
    job: {
      jobType,
      symbols,
      strategy: process.env.RESEARCH_STRATEGY || "daily-momentum-breakout",
      parameters: {
        lookbackDays: Number(process.env.RESEARCH_LOOKBACK_DAYS || 365),
        slippageBps: Number(process.env.RESEARCH_SLIPPAGE_BPS || 5),
        feeBps: Number(process.env.RESEARCH_FEE_BPS || 1),
      },
    },
  }),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok || payload.ok === false) {
  console.error(payload.error || `Worker dispatch failed with ${response.status}`);
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
