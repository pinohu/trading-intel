# Trading Intelligence Research Stack

This platform uses a layered research architecture:

1. Credentialed providers when keys exist.
2. Public/free fallbacks when credentials are missing.
3. Native TypeScript research engines for bounded workflows that can safely run inside the app.
4. External workers for heavyweight engines that do not belong inside Vercel serverless functions.
5. Durable SQL storage for signals, notes, backtests, outcomes, and AutoResearch runs.

## Provider Lanes

- Polygon.io: `POLYGON_API_KEY`, preferred stock snapshot provider when licensed.
- Twelve Data: `TWELVE_DATA_API_KEY`, optional quote provider for equities, ETFs, forex, and crypto depending on plan.
- Alpaca: `ALPACA_*`, broker sync, paper/live rails, stocks data, options/crypto endpoints when entitled.
- Benzinga: `BENZINGA_API_KEY`, structured market news.
- Finnhub: `FINNHUB_API_KEY`, company news.
- NewsAPI: `NEWSAPI_API_KEY`, broad article discovery.
- SEC EDGAR: free official filings through `data.sec.gov`; set `SEC_USER_AGENT` to a real contact string.
- Public fallbacks: Nasdaq/CNBC/Yahoo/Stooq/Binance keep the dashboard alive, but are not execution-grade licenses.

## Native TradingAgents Debate

TradingAgents no longer requires `TRADINGAGENTS_WORKER_URL`.

The dashboard button calls:

```text
POST /api/tradingagents/analyze
```

That route runs inside the Next.js codebase. It builds a bounded debate across market analyst, fundamentals analyst, bull researcher, bear researcher, trader, risk manager, and portfolio manager roles using:

- current quote/provider output from `/api/market`
- native rule signals
- SEC/factor evidence from Algorithm Council
- native Alpaca historical-bar backtests
- Postgres research-note persistence when `DATABASE_URL` is configured

It does not place broker orders. Manual paper/live orders still go through the visible broker controls, acknowledgement, and audit logging.

## External Worker URLs

Set these when you host workers outside Vercel:

- `OPENBB_WORKER_URL`
- `LEAN_WORKER_URL`
- `BACKTRADER_WORKER_URL`
- `VECTORBT_WORKER_URL`
- `NAUTILUS_WORKER_URL`
- `FINGPT_WORKER_URL`
- `FINRL_WORKER_URL`
- `JESSE_WORKER_URL`

The bridge endpoint is:

```text
POST /api/research-workers/run
```

with a payload:

```json
{
  "worker": "vectorbt",
  "job": {
    "jobType": "parameter-sweep",
    "symbols": ["SPY", "QQQ", "NVDA"],
    "strategy": "daily-momentum-breakout",
    "parameters": { "lookbackDays": 365 }
  }
}
```

Use `WORKER_SHARED_SECRET` for worker-to-worker authorization if the external service supports it.

## Free Alternatives

The platform uses SEC EDGAR, public quote fallbacks, Yahoo RSS, Binance public crypto, native Alpaca daily-bar backtests, and the bounded AutoResearch lab when paid services are not configured.

These are useful for research. They do not replace SIP, OPRA, CME/ICE, or paid news entitlements for execution-grade trading.
