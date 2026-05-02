# Broker Execution

The app includes an Alpaca broker execution rail. It is live-capable when live credentials, user session, acknowledgement, audit storage, and pre-trade limits are present.

## Supported Broker

- Alpaca Trading API
- Paper domain: `https://paper-api.alpaca.markets`
- Live domain: `https://api.alpaca.markets`
- Private requests use `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`.

References:

- Alpaca Trading API: https://docs.alpaca.markets/docs/trading-api
- Alpaca authentication: https://docs.alpaca.markets/docs/api-references/trading-api/
- Alpaca orders: https://docs.alpaca.markets/docs/trading/orders/

## What The App Allows

- Authenticated user-session broker access only.
- Day limit orders only.
- Whole-share stock/ETF symbols only.
- Configurable max order notional.
- Configurable max units.
- Manual live stock/ETF order submission when live Alpaca keys are configured.
- Live mode requires a per-order acknowledgement phrase.
- Live mode requires `DATABASE_URL` and `database/schema.sql` applied so order requests are auditable.

## What The App Blocks

- Cron/bearer automation cannot access `/api/broker/*`.
- Market orders are blocked.
- Fractional-share orders are blocked.
- Commodity futures aliases such as `OIL`, `GOLD`, `WHEAT`, and `CORN` are blocked because they are research aliases, not broker stock symbols.
- Current crypto aliases such as `BTCUSD` and `ETHUSD` are blocked from the stock/ETF broker rail.
- Extended-hours orders are blocked unless `BROKER_ALLOW_EXTENDED_HOURS=true`.

## Paper Mode Setup

```bash
vercel env add ALPACA_API_KEY_ID production
vercel env add ALPACA_API_SECRET_KEY production
vercel env add BROKER_EXECUTION_ENABLED production
vercel env add BROKER_EXECUTION_MODE production
```

Use these values:

```text
BROKER_EXECUTION_ENABLED=true
BROKER_EXECUTION_MODE=paper
```

Then redeploy:

```bash
vercel --prod --yes
```

## Live Mode Setup

Live mode places real-money orders. Before enabling it, apply `database/schema.sql` to a Postgres database and set `DATABASE_URL`.

Required values:

```text
BROKER_EXECUTION_ENABLED=true
BROKER_EXECUTION_MODE=live
BROKER_LIVE_EXECUTION_ACK=<a private phrase you must type into the app before each live order>
ALPACA_API_KEY_ID=<live Alpaca key>
ALPACA_API_SECRET_KEY=<live Alpaca secret>
DATABASE_URL=<Postgres connection string with schema applied>
```

`ALPACA_LIVE_TRADING_ENABLED=false` is an optional emergency lock. If it is absent or any value other than `false`, live mode is allowed to arm once the required credentials and acknowledgement are configured.

Optional risk caps:

```text
BROKER_MAX_ORDER_NOTIONAL=5000
BROKER_MAX_ORDER_UNITS=100
BROKER_ALLOW_EXTENDED_HOURS=false
```

## Smoke Tests

After login:

- `/api/broker/status`
- `/api/broker/account`
- `/api/broker/positions`
- `/api/broker/orders`

`POST /api/broker/orders?mode=live` should return `503` until live credentials, acknowledgement, audit storage, and pre-trade controls are ready.
