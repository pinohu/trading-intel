const baseUrl = process.env.TRADING_APP_URL || "https://trading-intel-platform.vercel.app";
const mode = process.env.BROKER_EXECUTION_MODE === "live" ? "live" : "paper";
const key = mode === "live" ? process.env.ALPACA_LIVE_API_KEY_ID : process.env.ALPACA_PAPER_API_KEY_ID || process.env.ALPACA_API_KEY_ID;
const secret = mode === "live" ? process.env.ALPACA_LIVE_API_SECRET_KEY : process.env.ALPACA_PAPER_API_SECRET_KEY || process.env.ALPACA_API_SECRET_KEY;
const sessionCookie = process.env.TRADING_SESSION_COOKIE;

if (typeof WebSocket === "undefined") {
  throw new Error("This worker requires a runtime with global WebSocket support.");
}
if (!key || !secret) {
  throw new Error("Alpaca credentials are required for alpaca-trade-updates-worker.mjs");
}
if (!sessionCookie) {
  throw new Error("TRADING_SESSION_COOKIE is required so the worker can call broker reconciliation APIs.");
}

const streamUrl = mode === "live" ? "wss://api.alpaca.markets/stream" : "wss://paper-api.alpaca.markets/stream";
const ws = new WebSocket(streamUrl);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ action: "authenticate", data: { key_id: key, secret_key: secret } }));
  ws.send(JSON.stringify({ action: "listen", data: { streams: ["trade_updates"] } }));
});

ws.addEventListener("message", async (event) => {
  console.log(new Date().toISOString(), String(event.data).slice(0, 1000));
  await fetch(`${baseUrl}/api/broker/reconcile?mode=${mode}`, {
    method: "POST",
    headers: {
      cookie: sessionCookie,
      "content-type": "application/json",
    },
  }).catch((error) => console.error(error.message));
});

ws.addEventListener("error", (event) => {
  console.error(new Date().toISOString(), "websocket error", event);
});

ws.addEventListener("close", (event) => {
  console.error(new Date().toISOString(), "websocket closed", event.code, event.reason);
  process.exit(1);
});
