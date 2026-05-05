# Production Runbook

## Health Checks

Run locally before every deploy:

```bash
npm run quality
npm audit --audit-level=high
```

Verify production:

```bash
vercel --prod --yes
```

Then authenticate and check:

- `/api/health`
- `/api/readiness`
- `/api/persistence/readiness`
- `/api/market`
- `/api/buy-now`
- `/api/monitor` with cron auth
- `/api/broker/status`
- `/api/research-workers/readiness`
- `/api/tradingagents/analyze` with an authenticated session; no worker URL is required

Optional OpenStock companion check:

- Set `OPENSTOCK_WORKER_URL` to the self-hosted companion worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "openstock"` and `jobType: "market-data"`.
- Confirm the worker returns search/watchlist/company/news/alert context and no broker-order side effects.

Optional Ghostfolio portfolio check:

- Set `GHOSTFOLIO_WORKER_URL` to the self-hosted portfolio worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "ghostfolio"` and `jobType: "portfolio"`.
- Confirm the worker returns portfolio exposure, allocation, holdings, transaction, and static risk context with no broker-order side effects.

Optional AKShare worker check:

- Set `AKSHARE_WORKER_URL` to the self-hosted Python worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "akshare"` and `jobType: "market-data"`.
- Confirm the worker returns source labels, timestamps, coverage, warnings, and no broker-order side effects.

Optional StockSharp worker check:

- Set `STOCKSHARP_WORKER_URL` to the self-hosted C#/.NET worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "stocksharp"` and `jobType: "backtest"`.
- Confirm the worker returns metrics without placing broker orders.

Optional RQAlpha worker check:

- Set `RQALPHA_WORKER_URL` to the self-hosted Python worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "rqalpha"` and `jobType: "backtest"`.
- Confirm the worker returns event-driven simulation metrics, transaction-cost assumptions, holdings/portfolio reports, risk/analyser output, and no broker-order side effects.

Optional StockPredictionAI worker check:

- Set `STOCKPREDICTIONAI_WORKER_URL` to the self-hosted forecast worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "stockpredictionai"` and `jobType: "forecast"`.
- Confirm the worker returns holdout metrics, overfit warnings, feature coverage, and no broker-order side effects.

Optional LLM Trading Lab worker check:

- Set `LLM_TRADING_LAB_WORKER_URL` to the self-hosted LLM experiment worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "llmtradinglab"` and `jobType: "agent-research"`.
- Confirm the worker returns forward-only decisions, hard-constraint checks, stop-loss compliance, benchmark comparisons, and no broker-order side effects.

Optional Stock Prediction Models worker check:

- Set `STOCK_PREDICTION_MODELS_WORKER_URL` to the self-hosted ML model worker endpoint.
- Dispatch a research-only job through `/api/research-workers/run` with `worker: "stockpredictionmodels"` and `jobType: "forecast"`.
- Confirm the worker returns model comparison metrics, holdout/walk-forward evidence, overfit warnings, and no broker-order side effects.

## Persistence Setup

1. Create a Postgres-compatible database.
2. Apply `database/schema.sql`.
3. Set `DATABASE_URL` in Vercel production.
4. Redeploy.
5. Confirm `/api/persistence/readiness` reports `databaseReachable: true`, `schemaReady: true`, and `persistenceEnabled: true`.

If `DATABASE_URL` exists but the schema is missing, persistence APIs return controlled `503` responses rather than silently dropping data.

## Broker Execution

Broker routes are under `/api/broker/*` and require a normal user session. Cron/bearer automation is blocked from those routes.

Paper mode requires:

- `BROKER_EXECUTION_ENABLED=true`
- `BROKER_EXECUTION_MODE=paper`
- `ALPACA_API_KEY_ID`
- `ALPACA_API_SECRET_KEY`

Live mode additionally requires:

- `ALPACA_LIVE_API_KEY_ID`
- `ALPACA_LIVE_API_SECRET_KEY`
- `BROKER_LIVE_EXECUTION_ACK`
- `DATABASE_URL` with `database/schema.sql` applied
- Pre-trade controls with `allowLiveOrders=true` and `TRADING_KILL_SWITCH=false`

The app only submits day limit orders. It blocks market orders, futures aliases, current crypto aliases, fractional shares, oversized orders, and extended-hours orders unless explicitly enabled.

## Market Data Outage

Symptoms:

- Dashboard says market data is unavailable.
- `/api/market` returns `503` with `quotes: []`.
- Buy-now board shows no candidates.

Response:

1. Check provider keys and provider status pages.
2. Check `/api/providers`.
3. Confirm `DEMO_MARKET_DATA` is not enabled in production.
4. Do not force fallback quotes into live mode.
5. Disable alerts if provider quality cannot be trusted.

## Auth Failure

Symptoms:

- Login returns `503`.
- Private routes return `503`.

Response:

1. Confirm `ACCESS_CODE` or `TRADING_ACCESS_CODE`, plus `TRADING_ACCESS_TOKEN`, are set in Vercel production.
2. Rotate both secrets if leakage is suspected.
3. Redeploy after secret changes.
4. Never reintroduce hardcoded fallback access codes.

## Cron Failure

Symptoms:

- `/api/monitor` returns `401`.
- Alert checks stop running.

Response:

1. Confirm `CRON_SECRET` exists in Vercel production.
2. Confirm Vercel Cron is invoking `/api/monitor`.
3. For manual verification, call the route with `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
4. Check alert provider env vars.

## Native TradingAgents Debate

Symptoms:

- Quant Lab says TradingAgents is unavailable.
- `/api/tradingagents/analyze` returns a market-data, factor, or backtest error.
- Decisions are missing expected transcript/evidence in the response `raw.agentDebates`.

Response:

1. Confirm the user is authenticated; the endpoint does not accept anonymous calls.
2. Check `/api/market` for the requested symbols.
3. Check `/api/research-stack/readiness` for SEC/factor and database readiness.
4. Check Alpaca historical bars if backtests return `insufficient-data`.
5. Re-run `npm run quality` before redeploying any route or debate-engine change.

## Rollback

1. Open the latest Vercel deployment.
2. Promote the previous known-good deployment.
3. Re-run the health checks above.
4. Record the incident and root cause.

## Release Checklist

- Lint passes.
- Tests pass.
- Build passes.
- No high/critical npm audit findings.
- Auth is fail-closed.
- Market data is not synthetic.
- `/api/readiness` missing-required list is understood.
- `/api/persistence/readiness` reports the expected database state.
- `/api/broker/status` reports the expected broker lock/armed state.
- README/docs updated for behavior changes.
