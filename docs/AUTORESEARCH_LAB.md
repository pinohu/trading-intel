# AutoResearch Lab

The AutoResearch Lab adapts the core idea of automated experiment loops to trading research:

- propose a small set of strategy variants,
- run bounded historical tests,
- score evidence after slippage, fees, drawdown, trade count, win rate, and profit factor,
- store the champion and rejected variants,
- keep everything research-only until proof gates and paper trading agree.

It is inspired by Andrej Karpathy's AutoResearch pattern, but it does not let an agent directly edit production trading code or place orders.

## API

```text
GET /api/autoresearch/lab
POST /api/autoresearch/lab?mode=paper
```

Example POST body:

```json
{
  "symbols": "SPY,QQQ,NVDA,TSLA",
  "lookbackDays": 180,
  "budget": 3
}
```

The POST route requires either a valid logged-in dashboard session or `CRON_SECRET` via `x-cron-secret` / bearer auth.

## Worker

```bash
npm run worker:autoresearch
```

Useful environment variables:

- `TRADING_APP_URL`
- `CRON_SECRET`
- `AUTORESEARCH_SYMBOLS`
- `AUTORESEARCH_BUDGET`
- `AUTORESEARCH_LOOKBACK_DAYS`
- `AUTORESEARCH_LOOP`
- `AUTORESEARCH_INTERVAL_MS`

## Promotion Rule

A champion is only the best candidate from the bounded experiment. It is not a buy/sell instruction. Promotion requires:

- stable out-of-sample results,
- paper-trading outcomes,
- slippage/fee assumptions,
- trade ticket with stop/target/size/max loss,
- broker reconciliation,
- human review before any live order.
