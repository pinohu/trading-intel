const appUrl = process.env.TRADING_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const symbols = process.env.AUTORESEARCH_SYMBOLS || process.env.MONITOR_WATCHLIST || "SPY,QQQ,NVDA,TSLA,AAPL,MSFT";
const intervalMs = Number(process.env.AUTORESEARCH_INTERVAL_MS || 24 * 60 * 60 * 1000);
const budget = Number(process.env.AUTORESEARCH_BUDGET || 3);
const lookbackDays = Number(process.env.AUTORESEARCH_LOOKBACK_DAYS || 180);

if (!secret) {
  console.error("CRON_SECRET is required for scripts/autoresearch-lab.mjs");
  process.exit(1);
}

async function runOnce() {
  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/autoresearch/lab?mode=paper`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": secret,
    },
    body: JSON.stringify({ symbols, budget, lookbackDays }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `AutoResearch request failed with ${response.status}`);
  }
  const champion = payload.champion;
  console.log(
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        runLabel: payload.runLabel,
        symbols: payload.symbols,
        champion: champion
          ? {
              id: champion.candidate.id,
              score: champion.score,
              metrics: champion.metrics,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

async function main() {
  console.log(`AutoResearch worker targeting ${appUrl}`);
  await runOnce().catch((error) => {
    console.error(`[autoresearch] initial run skipped: ${error.message}`);
    if (process.env.AUTORESEARCH_LOOP !== "true") {
      process.exitCode = 1;
    }
  });
  if (process.env.AUTORESEARCH_LOOP !== "true") return;
  setInterval(() => {
    runOnce().catch((error) => console.error(`[autoresearch] ${error.message}`));
  }, Number.isFinite(intervalMs) ? intervalMs : 24 * 60 * 60 * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
