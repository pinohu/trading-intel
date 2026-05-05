# Hummingbot Crypto Liquidity Worker

Hummingbot is integrated as an optional self-hosted crypto market-making and liquidity worker inspired by `hummingbot/hummingbot`.

## Configure

Set:

```text
HUMMINGBOT_WORKER_URL=
```

The worker should expose the existing `/api/research-workers/run` contract and accept only:

- `crypto-paper`
- `backtest`
- `parameter-sweep`

## Expected Evidence

Worker responses should include:

- Symbol/pair, base/quote asset, venue, CEX/DEX/AMM label, connector, and dry-run/live mode label.
- Strategy, controller, config version, inventory target, spread controls, order refresh rules, and parameter set.
- Backtest or dry-run range, candles/events used, fees, slippage/spread assumptions, fill count, cancel count, realized/unrealized P/L, profit factor when available, max drawdown, and rejected pairs.
- Parameter-sweep objective, search space, rejected runs, and overfit warning.
- Exchange/API permission warnings and confirmation that live exchange order placement is disabled for this bridge.

## Boundary

Hummingbot is Apache-2.0 licensed and can be self-hosted as a separate worker or service.

This bridge is crypto liquidity research and paper/dry-run only. Hummingbot output cannot replace execution-grade quote data, cannot authorize broker orders, and cannot place live exchange orders through `/api/research-workers/run`.
