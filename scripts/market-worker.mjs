const baseUrl = process.env.TRADING_APP_URL || "https://trading-intel-platform.vercel.app";
const cronSecret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.MARKET_WORKER_INTERVAL_MS || 30000);

if (!cronSecret) {
  throw new Error("CRON_SECRET is required for market-worker.mjs");
}

async function tick() {
  const response = await fetch(`${baseUrl}/api/monitor`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
  });
  const body = await response.text();
  console.log(new Date().toISOString(), response.status, body.slice(0, 500));
}

await tick();
setInterval(() => {
  tick().catch((error) => console.error(new Date().toISOString(), error.message));
}, Math.max(5000, intervalMs));
