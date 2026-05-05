# Alphalens Worker

`quantopian/alphalens` is integrated as an optional research-only factor-performance worker.

Use it for:

- factor tear sheets
- forward-return analysis
- information coefficient analysis
- factor turnover
- quantile return spreads
- grouped analysis by sector, asset class, or custom buckets
- missing-data and factor-universe warnings

Configure:

```bash
ALPHALENS_WORKER_URL=https://your-alphalens-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `factor-analysis`
- `backtest`
- `parameter-sweep`

Example dispatch:

```json
{
  "worker": "alphalens",
  "job": {
    "jobType": "factor-analysis",
    "symbols": ["SPY", "QQQ", "NVDA", "AAPL"],
    "strategy": "factor-tear-sheet",
    "parameters": {
      "factorName": "momentum_quality_value_blend",
      "periods": [1, 5, 10, 21],
      "quantiles": 5,
      "groupBy": "sector",
      "slippageBps": 5,
      "feeBps": 1,
      "requireInformationCoefficient": true
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

- factor universe and pricing source
- forward returns by horizon
- information coefficient and stability
- quantile returns and spreads
- turnover and capacity warnings
- grouped analysis
- missing-data and survivorship warnings
- cost/slippage assumptions

License note: Alphalens is Apache-2.0 licensed. Preserve license and NOTICE attribution if you distribute a worker that includes upstream source.

Do not route this worker to broker execution. Alphalens output can only add or subtract factor confidence after freshness, IC stability, turnover, costs, paper outcomes, and app-level risk controls are visible.
