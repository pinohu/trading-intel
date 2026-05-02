# AITable Operations Mirror

The platform can mirror operational trading records to AITable when Postgres is unavailable or when a human-readable operations layer is useful.

## What It Stores

- Quote snapshots
- Signal snapshots
- Trade tickets
- Paper trades
- Broker order requests and Alpaca responses
- Optional signal outcomes and watchlist records

## What It Is Not

AITable is not the execution-grade trading database. Live broker execution still requires the SQL audit database in `database/schema.sql` to be reachable and ready.

Do not use AITable for second-by-second market ticks, regulatory books and records, or the only source of truth for real-money order audit.

## Environment Variables

```bash
AITABLE_MIRROR_ENABLED=true
AITABLE_API_KEY=...
AITABLE_BASE_URL=https://aitable.ai
AITABLE_SPACE_ID=...
AITABLE_QUOTE_SNAPSHOTS_DATASHEET_ID=...
AITABLE_SIGNAL_SNAPSHOTS_DATASHEET_ID=...
AITABLE_TRADE_TICKETS_DATASHEET_ID=...
AITABLE_PAPER_TRADES_DATASHEET_ID=...
AITABLE_BROKER_ORDERS_DATASHEET_ID=...
AITABLE_SIGNAL_OUTCOMES_DATASHEET_ID=...
AITABLE_WATCHLIST_DATASHEET_ID=...
```

## Endpoints

- `GET /api/integrations/aitable/readiness`
- `GET /api/integrations/aitable/schema`
- `GET /api/integrations/aitable/records?table=paperTrades&limit=50`

## Fallback Behavior

- `POST /api/signal-snapshots` writes to Postgres when possible and mirrors to AITable when configured. If Postgres fails but AITable succeeds, the request still succeeds.
- `GET /api/paper-trades` falls back to AITable records when Postgres is unavailable.
- `POST /api/paper-trades` writes to Postgres when possible and mirrors to AITable when configured.
- `POST /api/trade-ticket` stores the ticket in Postgres when possible and mirrors to AITable.
- `POST /api/broker/orders` mirrors submitted or rejected broker orders to AITable.
