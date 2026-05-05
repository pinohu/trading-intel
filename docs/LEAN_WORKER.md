# LEAN Worker

LEAN is integrated as an optional self-hosted event-driven algorithm worker inspired by `QuantConnect/Lean`.

## Configure

Set:

```text
LEAN_WORKER_URL=
```

The worker should expose the existing `/api/research-workers/run` contract and accept only:

- `backtest`
- `parameter-sweep`

## Expected Evidence

Worker responses should include:

- Project, algorithm, language, and LEAN engine version.
- Symbols, asset class, market, resolution, timezone, and data source.
- Backtest range, warmup, fees, slippage, fill model, buying-power model, and brokerage model.
- Trade count, win rate, profit factor, total return, benchmark return, Sharpe/Sortino if available, and max drawdown.
- Optimizer objective, parameter grid/search space, best run, rejected runs, and overfit warning.
- Paper/live mode label and confirmation that live brokerage order placement is disabled for this bridge.

## Boundary

LEAN is Apache-2.0 licensed and can be self-hosted as a separate worker or service.

This bridge is research/backtest/optimization only. LEAN output cannot replace execution-grade quote data, cannot authorize broker orders, and cannot place live orders through `/api/research-workers/run`.

