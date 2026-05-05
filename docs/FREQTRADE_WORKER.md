# Freqtrade Crypto Worker

Freqtrade is integrated as an optional self-hosted crypto strategy worker inspired by `freqtrade/freqtrade`.

## Configure

Set:

```text
FREQTRADE_WORKER_URL=
```

The worker should expose the existing `/api/research-workers/run` contract and accept only:

- `crypto-paper`
- `backtest`
- `parameter-sweep`

## Expected Evidence

Worker responses should include:

- Symbol/pair, timeframe, exchange, and dry-run/live mode label.
- Strategy name, config version, and parameter set.
- Backtest range, candles used, fees, slippage/spread assumptions, trade count, win rate, profit factor, max drawdown, and rejected pairs.
- Hyperopt or parameter-sweep objective, search space, and overfit warning.
- Paper/dry-run order summaries only when explicitly requested.
- Exchange/API permission warnings and confirmation that live exchange order placement is disabled for this bridge.

## Boundary

Freqtrade is GPL-3.0 licensed. Keep it self-hosted as a separate worker or service; do not vendor its source into this app without accepting GPL obligations.

This bridge is crypto research and paper/dry-run only. Freqtrade output cannot replace execution-grade quote data, cannot authorize broker orders, and cannot place live exchange orders through `/api/research-workers/run`.

