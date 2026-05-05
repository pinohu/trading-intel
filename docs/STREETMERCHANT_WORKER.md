# StreetMerchant Worker

`jef/streetmerchant` is integrated as an optional alert-operations reference worker.

StreetMerchant monitors retail inventory stock, not financial equities. In this app, use it only for alert-loop discipline:

- persistent watch loops
- source/status matrices
- notification fanout
- cooldown and retry policy
- dashboard alert state
- manual-action guardrails

Configure:

```bash
STREETMERCHANT_WORKER_URL=https://your-streetmerchant-alert-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job family:

- `alert-monitor`

Example dispatch:

```json
{
  "worker": "streetmerchant",
  "job": {
    "jobType": "alert-monitor",
    "symbols": ["NVDA", "AMD", "SPY"],
    "strategy": "trigger-watch-alert-fanout",
    "parameters": {
      "cooldownSeconds": 300,
      "requireManualAction": true,
      "channels": ["browser", "webhook"],
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

- watch-loop status
- source/channel matrix
- trigger and cooldown state
- last notification result
- retry/backoff warnings
- manual-action requirement
- explicit note that no financial market data or order routing was produced

License note: StreetMerchant is MIT licensed. Preserve license attribution if you distribute a worker that includes upstream source.

Do not route this worker to broker execution. Its output can only improve alert operations and trust reporting; it cannot create buy/sell signals or authorize trades.
