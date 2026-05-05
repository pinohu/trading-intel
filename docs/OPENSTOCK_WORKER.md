# OpenStock Companion Worker

OpenStock is integrated as an optional self-hosted companion worker/reference lane.

Use it for market-app workflow comparison and research context such as:

- stock search
- watchlists
- company insights
- market and news context
- alerts
- auth-backed personal market dashboards

Configure:

```bash
OPENSTOCK_WORKER_URL=https://your-openstock-companion.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `market-data`
- `fundamentals`
- `nlp`

Example dispatch:

```json
{
  "worker": "openstock",
  "job": {
    "jobType": "market-data",
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "strategy": "companion-watchlist-context",
    "parameters": {
      "includeNews": true,
      "includeCompanyInsights": true,
      "includeAlerts": true
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

License note: OpenStock is AGPL-3.0 licensed. This app does not vendor or copy OpenStock source. Treat it as a separately hosted companion/reference system unless you intentionally accept AGPL obligations for combined distribution.

OpenStock output should return source labels, timestamps, context, warnings, and any alert/watchlist state. It must not place broker orders or bypass the app's live-agent acknowledgement, audit, and pre-trade controls.
