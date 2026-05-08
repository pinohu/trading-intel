# RQAlpha Worker

`ricequant/rqalpha` is integrated as an optional research-only Python event-driven backtest worker.

Use it for:

- event-driven backtests
- scheduled strategy logic checks
- simulated order and fill evidence
- slippage and transaction-cost assumptions
- risk Mod and analyser-style outputs
- holdings and portfolio records
- parameter sweeps before any paper/live promotion

Configure:

```bash
RQALPHA_WORKER_URL=https://your-rqalpha-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `backtest`
- `parameter-sweep`
- `portfolio`

Example dispatch:

```json
{
  "worker": "rqalpha",
  "job": {
    "jobType": "backtest",
    "symbols": ["000001.XSHE", "000300.XSHG"],
    "strategy": "event-driven-momentum-cost-check",
    "parameters": {
      "frequency": "1d",
      "benchmark": "000300.XSHG",
      "slippageBps": 5,
      "feeBps": 3,
      "requireRiskMod": true,
      "paperOnly": true
    }
  }
}
```

The app sends every worker request with:

```json
{
  "researchOnly": true,
  "noAutonomousExecution": true,
  "brokerOrdersBlocked": true
}
```

Expected worker response:

- simulated order and fill ledger
- transaction-cost assumptions
- risk pre-check pass/fail state
- holdings and portfolio curve
- benchmark comparison
- analyser metrics
- warnings for missing data, survivorship bias, non-commercial license boundaries, or overfit risk

License note: upstream RQAlpha allows non-commercial use under Apache 2.0 terms and requires Ricequant authorization for commercial use. This app treats the project as a separately hosted reference/worker contract and does not vendor or copy its source.

Do not route this worker to broker execution. Its output can only add or subtract research confidence after event-simulation proof, walk-forward validation, slippage/fee assumptions, paper outcomes, and app-level risk gates are visible.
