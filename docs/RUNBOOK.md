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
- `/api/tradingagents/analyze` with an authenticated session when `TRADINGAGENTS_WORKER_URL` is configured

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

1. Confirm `TRADING_ACCESS_CODE` and `TRADING_ACCESS_TOKEN` are set in Vercel production.
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

## TradingAgents Worker

Symptoms:

- Quant Lab says TradingAgents is unavailable.
- `/api/tradingagents/analyze` returns `TRADINGAGENTS_WORKER_URL is not configured`.
- The worker returns `TradingAgents is not installed`.

Response:

1. Run the worker outside Vercel: `npm run worker:tradingagents`.
2. Install the Python package in that worker environment: `pip install git+https://github.com/TauricResearch/TradingAgents.git`.
3. Set at least one LLM provider key for the worker, such as `OPENAI_API_KEY`.
4. Set `TRADINGAGENTS_WORKER_URL` in Vercel production and redeploy.
5. Keep `WORKER_SHARED_SECRET` aligned between Vercel and the worker if you require bearer auth.

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
