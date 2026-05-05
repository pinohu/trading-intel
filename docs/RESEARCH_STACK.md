# Trading Intelligence Research Stack

This platform uses a layered research architecture:

1. Free/public providers by default.
2. Credentialed providers only when the user selects or configures them.
3. Native TypeScript research engines for bounded workflows that can safely run inside the app.
4. External workers for heavyweight engines that do not belong inside Vercel serverless functions.
5. Durable SQL storage for signals, notes, backtests, outcomes, and AutoResearch runs.

## Provider Lanes

- Free-first market data: composite public stocks, Nasdaq/CNBC public quotes, Yahoo charts/futures aliases, Stooq delayed quotes, and Binance public crypto.
- Alpaca: `ALPACA_*`, broker sync, paper/live rails, Basic IEX stocks data, options/crypto endpoints when entitled, and optional SIP when configured.
- Polygon.io: `POLYGON_API_KEY`, optional paid/entitled stock snapshot provider.
- Twelve Data: `TWELVE_DATA_API_KEY`, optional quote provider for equities, ETFs, forex, and crypto depending on plan.
- Free-first news: Yahoo Finance RSS plus SEC filing and event-risk context.
- Benzinga: `BENZINGA_API_KEY`, optional structured market news.
- Finnhub: `FINNHUB_API_KEY`, optional company news.
- NewsAPI: `NEWSAPI_API_KEY`, optional broad article discovery.
- SEC EDGAR: free official filings through `data.sec.gov`; set `SEC_USER_AGENT` to a real contact string.
- Analyst chat: `LOCAL_LLM_BASE_URL` and `LOCAL_LLM_MODEL` can point to a free/self-hosted OpenAI-compatible endpoint before paid OpenAI models.

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
- `OPENSTOCK_WORKER_URL`
- `STREETMERCHANT_WORKER_URL`
- `GHOSTFOLIO_WORKER_URL`
- `AKSHARE_WORKER_URL`
- `LLM_TRADING_LAB_WORKER_URL`
- `LEAN_WORKER_URL`
- `STOCKSHARP_WORKER_URL`
- `RQALPHA_WORKER_URL`
- `LSTM_TIME_SERIES_WORKER_URL`
- `STOCKPREDICTIONAI_WORKER_URL`
- `STOCK_PREDICTION_MODELS_WORKER_URL`
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

## OpenStock Companion Worker

OpenStock is integrated as an optional self-hosted companion market-app worker. Configure `OPENSTOCK_WORKER_URL` to expose search, watchlists, company insights, market/news context, alerts, and UX comparison through the existing worker bridge.

Accepted job families:

- `market-data`
- `fundamentals`
- `nlp`

OpenStock is AGPL-3.0 licensed, so this app treats it as a separately hosted companion/reference lane and does not vendor its source. Worker output must remain research-only and cannot place broker orders.

## StreetMerchant Alert Worker

StreetMerchant is integrated as an optional self-hosted alert-operations worker. Configure `STREETMERCHANT_WORKER_URL` only when you want a separate worker to pressure-test watch loops, source/status matrices, notification fanout, retry/cooldown policy, and manual-action guardrails through the existing worker bridge.

Accepted job family:

- `alert-monitor`

Important boundary: StreetMerchant monitors retail inventory stock, not financial equities. This app uses it only as an alert-loop and notification-pattern reference. It must not be treated as market data, a buy/sell signal, or broker-order authorization.

StreetMerchant is MIT licensed. Preserve license attribution if you distribute a worker that includes upstream source.

## Ghostfolio Portfolio Worker

Ghostfolio is integrated as an optional self-hosted portfolio analytics companion. Configure `GHOSTFOLIO_WORKER_URL` to expose portfolio performance, holdings, transactions, allocation, import/export, and static risk context through the existing worker bridge.

Accepted job families:

- `portfolio`
- `market-data`
- `fundamentals`

Ghostfolio is AGPL-3.0 licensed, so this app treats it as a separately hosted companion/reference lane and does not vendor its source. Worker output must remain research-only and cannot place broker orders.

## AKShare Worker

AKShare is integrated as a free/self-hosted Python research data worker. Configure `AKSHARE_WORKER_URL` when you want broader China/Asia, macro, futures, bonds, options, funds, or reference-data coverage through the existing worker bridge.

Accepted job families:

- `market-data`
- `fundamentals`

AKShare output must stay labeled as research data unless a separate licensed/execution-grade feed confirms trade-critical prices. The worker request includes `safety.researchOnly=true`, `safety.noAutonomousExecution=true`, and `safety.brokerOrdersBlocked=true`.

## StockSharp Worker

StockSharp is integrated as a self-hosted C#/.NET worker, not as code running inside the Next.js serverless app. Configure `STOCKSHARP_WORKER_URL` to expose StockSharp research jobs through the existing worker bridge.

Accepted job families:

- `backtest`
- `parameter-sweep`
- `crypto-paper`

The worker request includes `safety.researchOnly=true`, `safety.noAutonomousExecution=true`, and `safety.brokerOrdersBlocked=true`. Keep StockSharp live execution behind the app's normal operator-armed live-agent route instead of accepting broker orders from `/api/research-workers/run`.

## RQAlpha Worker

RQAlpha is integrated as a self-hosted Python event-driven backtest worker, not as code running inside the Next.js serverless app. Configure `RQALPHA_WORKER_URL` to expose RQAlpha-style research jobs through the existing worker bridge.

Accepted job families:

- `backtest`
- `parameter-sweep`
- `portfolio`

Use it for event-driven simulation, scheduled strategy logic, Mod-style risk and analyser extensions, transaction-cost assumptions, fills, holdings, and portfolio reports. Worker output must stay research-only and cannot place orders.

RQAlpha's upstream license allows non-commercial use under Apache 2.0 terms and requires Ricequant authorization for commercial use. This app treats it as a separately hosted worker/reference lane and does not vendor its source.

## StockPredictionAI Worker

StockPredictionAI is integrated as a self-hosted research forecast worker. Configure `STOCKPREDICTIONAI_WORKER_URL` to expose GAN/LSTM/CNN-style stock-movement forecasts through the existing worker bridge.

Accepted job families:

- `forecast`
- `parameter-sweep`
- `nlp`

The reference GitHub repo did not expose a license file during integration, so this app treats it as an architectural/modeling reference and worker contract only. Do not vendor or redistribute its source from this codebase without legal review or explicit permission.

Worker output must remain research-only and cannot place orders. Fusion Alpha can use it as a forecast pressure lane only after holdout evidence, slippage/fee assumptions, data freshness, and overfit warnings are visible.

## LSTM Time Series Worker

LSTM Time Series is integrated as a self-hosted research forecast worker inspired by `jaungiers/LSTM-Neural-Network-for-Time-Series-Prediction`. Configure `LSTM_TIME_SERIES_WORKER_URL` to expose sequence-window LSTM forecasts through the existing worker bridge.

Accepted job families:

- `forecast`
- `parameter-sweep`
- `backtest`

The reference repo is AGPL-3.0 licensed and built around older Keras/TensorFlow dependencies, so this app treats it as a separate worker/reference lane and does not vendor source. Worker output must include train/test split, sequence length, holdout or walk-forward metrics, benchmark comparison, and dependency/version warnings before Fusion Alpha can use it as forecast pressure.

## LLM Trading Lab Worker

LLM Trading Lab is integrated as a self-hosted LLM trading experiment worker. Configure `LLM_TRADING_LAB_WORKER_URL` for forward-only daily decisions, portfolio logs, hard-constraint checks, stop-loss compliance, benchmark comparisons, and risk/performance metrics.

Accepted job families:

- `agent-research`
- `portfolio`
- `backtest`
- `forecast`

No root license file was visible during integration, so this app treats the repository as a reference and worker contract only. Worker output must remain research-only and cannot place orders.

## Stock Prediction Models Worker

Stock Prediction Models is integrated as a self-hosted model-zoo worker inspired by `huseinzol05/Stock-Prediction-Models`. Configure `STOCK_PREDICTION_MODELS_WORKER_URL` for research-only deep learning forecasts, stacking, simulations, and RL-agent experiments.

Accepted job families:

- `forecast`
- `backtest`
- `parameter-sweep`
- `rl-research`
- `crypto-paper`

The reference repo is archived and Apache-2.0 licensed. Treat worker output as research pressure only until current-data reproduction, holdout/walk-forward proof, cost assumptions, freshness labels, and risk gates agree.

## Free Alternatives

The platform uses these free paths first:

- Public composite stock quotes, Yahoo futures aliases, Binance public crypto, and Stooq delayed data before Polygon/Twelve Data.
- Yahoo Finance RSS before Benzinga/Finnhub/NewsAPI.
- SEC EDGAR submissions and CompanyFacts for filings and fundamentals.
- Browser notifications before Twilio/Resend.
- `LOCAL_LLM_BASE_URL` for a local/self-hosted analyst chat model before paid cloud LLMs.
- Native TradingAgents, cost-aware backtests, and AutoResearch before external hosted workers.
- Local/self-hosted or free-tier Postgres via `DATABASE_URL` before optional Supabase companion services.

These are useful for research. They do not replace SIP, OPRA, CME/ICE, or paid news entitlements for execution-grade trading.
