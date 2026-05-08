# Production Trading Operations

This platform is now wired as a trading research and broker-operations system with durable evidence loops.

## Core Production Loops

- `GET /api/ops/status` shows database, AITable, broker, alert, live-data, and remaining-limit readiness.
- `GET /api/persistence/readiness` verifies Postgres reachability and schema coverage.
- `GET /api/risk/portfolio?mode=paper` syncs Alpaca account, positions, open orders, exposure, daily P/L, and concentration risk.
- `POST /api/broker/sync?mode=paper` stores broker order lifecycle snapshots.
- `POST /api/outcomes` evaluates stored signal snapshots at 5m, 15m, 1h, and 1d horizons.
- `GET /api/model-performance` reports signal counts, outcome averages, hit targets/stops, and recent backtests.
- `GET /api/backtest?mode=paper&symbols=SPY,QQQ,NVDA&lookbackDays=180` runs the Alpaca historical-bars backtest and stores the result.
- `GET /api/options/workflow?mode=paper&symbols=SPY` scans Alpaca option contracts and ranks contract candidates.
- `GET /api/commodities/execution-workflow?symbol=GOLD` maps commodity research symbols to Alpaca-tradeable ETF proxies such as `GLD`.
- `GET /api/stream/status?mode=paper` reports Alpaca websocket endpoints and the current serverless polling mode.

## Live Trading Gates

Live broker orders remain locked unless all of these are true:

- `BROKER_EXECUTION_ENABLED=true`
- `ALPACA_LIVE_API_KEY_ID` and `ALPACA_LIVE_API_SECRET_KEY` are configured
- `BROKER_LIVE_EXECUTION_ACK` is configured and sent with each live order request
- Postgres schema is ready, so every live order has an audit record
- Pre-trade controls allow live orders and the kill switch is off

`ALPACA_LIVE_TRADING_ENABLED=false` can still force-disable live trading during an incident.

Live agent orders add two more gates:

- `AGENT_LIVE_TRADING_ENABLED=true`
- `CONTROL_ALLOW_LIVE_AGENT_ORDERS=true` or control-plane state `allowLiveAgentOrders=true`

Even when those gates are armed, each live agent submission must come from a logged-in operator session with `confirmLiveAgentTrading=true` and the matching live acknowledgement phrase. Cron and bearer-secret workers cannot submit live-money agent orders.

## Current Data Policy

The dashboard's default `auto` data mode is free-first: public composite stock quotes, Binance public crypto, Yahoo public futures aliases, and Stooq delayed fallback run before optional paid providers. Alpaca market data uses `feed=iex` unless `ALPACA_DATA_QUALITY=sip` is intentionally configured. IEX and public feeds are useful for research and paper trading, while SIP or another licensed feed is still the right path for execution-grade U.S. equity coverage.

Commodity futures remain research-only aliases unless a licensed futures broker and feed are added. Alpaca can route commodity ETF proxies, not CME/NYMEX/COMEX futures contracts.

## Current Alert And LLM Policy

Browser notifications are the free alert baseline. Webhook, Twilio, and Resend are optional off-device channels.

Analyst chat tries `LOCAL_LLM_BASE_URL` with `LOCAL_LLM_MODEL` before paid OpenAI cloud models. If neither path is available, it answers from deterministic dashboard context only.
