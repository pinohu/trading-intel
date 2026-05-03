# Market Data Policy

## Production Rule

Production must never invent market data.

If all providers fail, live routes return no quotes and explain that market data is unavailable. Buy-now signals are blocked until fresh data returns.

## Demo Mode

`DEMO_MARKET_DATA=true` enables deterministic demo quotes. This is only for UI demos and local development.

Demo quotes must not be used for:

- Buy-now decisions.
- Alerts.
- Paper performance measurement.
- Broker execution.
- Marketing claims.

## Data Quality Labels

- `Execution Grade`: licensed data suitable for tighter trading workflows, depending on provider permission.
- `Public Real-Time`: public timestamped quote path. Useful for research, not guaranteed execution-grade.
- `Partial Market`: incomplete or venue-limited view.
- `Unofficial`: provider endpoint not sold as a trading feed.
- `Delayed`: delayed quotes.
- `Offline`: demo/fallback only.

## Free-First Routing

The default `auto` provider mode avoids paid keys first:

- Public composite stocks: Nasdaq/CNBC/Yahoo range enrichment.
- Public crypto: Binance market-data endpoint for `BTCUSD` and `ETHUSD`.
- Commodity research: Yahoo futures aliases plus ETF proxies.
- Delayed fallback: Stooq.

Paid/credentialed providers remain available through explicit provider selection or environment keys. Free feeds stay research-only unless a licensed/entitled provider confirms the same trade-critical fields.

## Required Before Real-Money Use

- Licensed consolidated equities feed or broker-authorized market data.
- Licensed futures/commodities data where applicable.
- Provider terms-of-service review.
- Quote snapshot persistence.
- Source timestamp and provider latency tracking.
- Stale-data alarms.
- Signal outcome tracking against the exact quote snapshot used at generation time.
