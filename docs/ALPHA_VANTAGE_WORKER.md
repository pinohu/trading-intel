# Alpha Vantage Worker

`RomelTorres/alpha_vantage` is integrated as an optional free-account market-data worker.

Use it for:

- daily and intraday time series
- adjusted historical bars
- technical indicators
- fundamentals
- FX and crypto context
- economic data enrichment
- provider warning and rate-limit visibility

Configure:

```bash
ALPHA_VANTAGE_WORKER_URL=https://your-alpha-vantage-worker.example.com/run
ALPHAVANTAGE_API_KEY=your-free-alpha-vantage-key
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `market-data`
- `fundamentals`
- `forecast`

Example dispatch:

```json
{
  "worker": "alphavantage",
  "job": {
    "jobType": "market-data",
    "symbols": ["IBM", "AAPL", "MSFT"],
    "strategy": "daily-adjusted-with-rate-labels",
    "parameters": {
      "function": "TIME_SERIES_DAILY_ADJUSTED",
      "outputSize": "compact",
      "includeTechnicalIndicators": true,
      "requireProviderWarnings": true
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

- source function and symbol
- provider timestamp
- adjusted/delayed/incomplete labels
- rate-limit or provider-warning status
- quote/bar data used for research
- optional indicator or fundamentals payloads
- explicit statement that no broker order was produced

License note: the wrapper is MIT licensed. Preserve license attribution if you distribute a worker that includes upstream source.

Do not route this worker to broker execution. Alpha Vantage output can enrich research, but live-quality trade decisions still require fresh trade-critical quotes, source-quality labels, risk controls, and the app's paper/live gates.
