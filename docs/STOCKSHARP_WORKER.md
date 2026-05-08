# StockSharp Worker

StockSharp is integrated as an optional self-hosted C#/.NET worker.

The Next.js app does not import StockSharp directly. It calls a worker URL through:

```text
POST /api/research-workers/run
```

Configure:

```bash
STOCKSHARP_WORKER_URL=https://your-stocksharp-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Example dispatch:

```json
{
  "worker": "stocksharp",
  "job": {
    "jobType": "backtest",
    "symbols": ["SPY", "QQQ", "NVDA"],
    "strategy": "daily-momentum-breakout",
    "parameters": {
      "lookbackDays": 365,
      "slippageBps": 5,
      "feeBps": 1
    }
  }
}
```

The worker receives normalized symbols, `requestedAt`, `source: "trading-intel-platform"`, and this safety object:

```json
{
  "researchOnly": true,
  "noAutonomousExecution": true,
  "brokerOrdersBlocked": true
}
```

Expected worker behavior:

- Run StockSharp connector research, market-data ingestion checks, strategy tests, parameter sweeps, or crypto-paper simulations.
- Return JSON metrics, evidence, errors, and warnings.
- Do not place broker orders from the research-worker endpoint.
- Route any future real-money execution through the app's operator-armed live-agent path with user session, acknowledgement, audit storage, pre-trade controls, and kill-switch clearance.

StockSharp is Apache-2.0 licensed. Preserve the license and NOTICE attribution when distributing a worker that includes StockSharp source or binaries.
