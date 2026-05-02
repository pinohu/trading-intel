const baseUrl = process.env.TRADING_APP_URL || "https://trading-intel-platform.vercel.app";
const cronSecret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.PROOF_WORKER_INTERVAL_MS || 60000);

if (!cronSecret) {
  throw new Error("CRON_SECRET is required for proof-worker.mjs");
}

async function call(path, method = "GET") {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
  });
  const text = await response.text();
  console.log(new Date().toISOString(), path, response.status, text.slice(0, 500));
}

async function tick() {
  await call("/api/outcomes", "POST");
  await call("/api/proof/validation?persist=true");
}

await tick();
setInterval(() => {
  tick().catch((error) => console.error(new Date().toISOString(), error.message));
}, Math.max(15000, intervalMs));
