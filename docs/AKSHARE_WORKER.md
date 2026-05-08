# AKShare Worker

AKShare is integrated as an optional free/self-hosted Python research data worker.

Use it when you want broader data coverage for:

- China/Asia equity and index research
- macroeconomic datasets
- futures, bonds, options, funds, and reference data
- non-US context that the default public U.S.-focused quote stack does not cover well

Configure:

```bash
AKSHARE_WORKER_URL=https://your-akshare-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `market-data`
- `fundamentals`

Example dispatch:

```json
{
  "worker": "akshare",
  "job": {
    "jobType": "market-data",
    "symbols": ["000001.SZ", "600519.SH", "HSI"],
    "strategy": "cross-market-context",
    "parameters": {
      "lookbackDays": 365,
      "dataset": "daily-bars"
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

AKShare output should always return source labels, timestamps, coverage, and warnings. Treat AKShare data as research context unless a separate licensed/execution-grade feed confirms trade-critical prices.

License note: AKShare is MIT licensed. Preserve attribution and license text if you distribute a worker that includes AKShare.
