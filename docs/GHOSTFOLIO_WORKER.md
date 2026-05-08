# Ghostfolio Portfolio Worker

Ghostfolio is integrated as an optional self-hosted portfolio analytics companion.

Use it when you want account-level context such as:

- portfolio performance
- holdings and allocation
- transaction history
- import/export workflows
- multi-account context
- static risk analysis
- concentration and exposure checks before new trades

Configure:

```bash
GHOSTFOLIO_WORKER_URL=https://your-ghostfolio-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `portfolio`
- `market-data`
- `fundamentals`

Example dispatch:

```json
{
  "worker": "ghostfolio",
  "job": {
    "jobType": "portfolio",
    "symbols": ["SPY", "NVDA", "MSFT"],
    "strategy": "exposure-check",
    "parameters": {
      "includeTransactions": true,
      "includeAllocation": true,
      "includeStaticRisk": true
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

- portfolio exposure by symbol, sector, and asset class
- concentration warnings
- existing holdings and open lots
- historical performance context
- transaction and allocation summaries
- static risk flags

License note: Ghostfolio is AGPL-3.0 licensed. This app does not vendor or copy Ghostfolio source. Treat it as a separately hosted companion/reference system unless you intentionally accept AGPL obligations for combined distribution.

Ghostfolio output must not place broker orders or bypass the app's live-agent acknowledgement, audit, kill-switch, and pre-trade controls.
