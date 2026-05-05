# Trading Intelligence Platform

Live production URL:

https://trading-intel-platform.vercel.app

This is a mobile-first trading research and intelligence cockpit. It is built for research, watchlists, paper-trade planning, broker-gated execution, and risk discipline. Live-money agent orders are available only when explicitly armed by an operator and acknowledged per order.

## Current Capabilities

- Mobile dashboard deployed on Vercel
- Production hardening pass: fail-closed auth, no hardcoded access-code fallback, API input guards, baseline security headers, login rate limiting, provider timeouts, and no synthetic live quotes unless demo mode is explicitly enabled
- Database-ready persistence layer for quote snapshots, signal snapshots, trade tickets, paper trades, signal outcomes, provider health, and audit events
- SQL production schema in `database/schema.sql`
- `/api/persistence/readiness` endpoint that checks database reachability, schema readiness, and cache state
- `/api/signal-snapshots` endpoint to store quote and signal snapshots when `DATABASE_URL` is configured
- `/api/paper-trades` endpoint for database-backed paper-trade storage when `DATABASE_URL` is configured
- `/api/model-performance` endpoint for signal/outcome summary once persistence is enabled
- Soft-fail audit logging for login attempts, paper-trade creation, and signal snapshot creation when persistence is enabled
- Alpaca broker execution rail with `/api/broker/status`, `/api/broker/account`, `/api/broker/positions`, and `/api/broker/orders`
- Broker order placement is locked behind user-session auth, environment gates, limit-order-only validation, max notional/unit caps, live acknowledgement, and database-backed audit storage for live mode
- Algorithm Council using SEC CompanyFacts fundamentals, Piotroski F-score, Beneish/Sloan accounting-risk checks, quality/value/profitability/investment discipline, momentum, and data-risk gates
- `/api/algorithms` endpoint that returns ranked fundamental-factor research scores, plain-English thesis/bear case, risk controls, and persisted snapshots when `DATABASE_URL` is configured
- Durable `fundamental_snapshots` and `factor_snapshots` tables with SEC filing-period provenance for model-review history and future outcome tracking
- Institutional Gates dashboard covering proof validation, control state, worker readiness, and compliance boundary
- `/api/institutional/readiness`, `/api/proof/validation`, `/api/control-plane`, `/api/worker/readiness`, and `/api/compliance/readiness` for production operating checks
- Execution control plane with kill switch, paper/live permission flags, a separate live-agent arm, max open orders, max per-symbol orders, and daily/single-order notional caps
- Broker order placement now passes through pre-trade control checks before Alpaca submission
- Broker reconciliation endpoint at `/api/broker/reconcile` that stores REST order/activity reconciliation events and documents the Alpaca `trade_updates` streaming rail
- Catalyst engine at `/api/catalysts` combining SEC recent filings, market headlines, macro events, and commodity event calendars
- Direct SEC filings endpoint at `/api/sec/filings`, backed by the official `data.sec.gov` submissions API
- Free-first market-data routing: public composite stock quotes, Binance crypto, Yahoo futures aliases, and Stooq delayed fallback run before optional paid providers
- Polygon.io and Twelve Data quote adapters that activate only when `POLYGON_API_KEY` or `TWELVE_DATA_API_KEY` is configured or selected
- Free-first news routing through Yahoo Finance RSS, with optional Benzinga, Finnhub, and NewsAPI structured-news adapters
- Research Stack dashboard and `/api/research-stack/readiness` showing applied free replacements, credentialed providers, native research engines, external workers, and database readiness
- `/api/provider-stack/readiness` for market/news/database provider status without exposing secrets
- `/api/research-notes` for database-backed notes across devices
- AutoResearch Lab at `/api/autoresearch/lab`, with bounded candidate experiments, champion scoring, run history, and a research-only guardrail
- External worker bridge at `/api/research-workers/run` and `/api/research-workers/readiness` for OpenBB, Alpha Vantage, Alphalens, OpenStock, StockSight, StreetMerchant alert ops, Ghostfolio, AKShare, LSTM Time Series, LLM Trading Lab, LEAN, StockSharp, RQAlpha, Freqtrade, StockPredictionAI, Stock Prediction Models, Backtrader, vectorbt, NautilusTrader, FinGPT, FinRL, and Jesse workers outside Vercel
- Native systematic-trading reference map inspired by `awesome-systematic-trading`, used to keep data, alpha, analytics, backtest, live-control, architecture, tooling, resource, and AI/LLM proof lanes visible before a setup is trusted
- Native TradingAgents integration at `/api/tradingagents/analyze` for in-code market/fundamental/bull/bear/trader/risk/portfolio-manager debate persisted to research notes when Postgres is configured
- Analyst chat can use `LOCAL_LLM_BASE_URL` with a free/self-hosted OpenAI-compatible model before paid OpenAI models, then deterministic cockpit fallback
- Supervised agent-trading rail at `/api/agent-trader/policy`, `/api/agent-trader/proposals`, and `/api/agent-trader/execute`; agents can draft orders, paper-trade, and submit live-money orders only when live-agent gates and per-order acknowledgement pass
- Options volatility context at `/api/options/volatility` using Alpaca contracts/snapshots where available, with OPRA/indicative/contract-only quality labels
- Walk-forward holdout metadata in new backtest runs, plus persisted model-validation reports
- Persistent worker scripts for market scanning, proof/outcome evaluation, and Alpaca trade-update reconciliation in `scripts/`
- Ising/QUBO basket optimizer using deterministic classical simulated annealing to choose the best set of buy leads under budget, risk, max-position, and overlap constraints
- `/api/optimizer/ising` endpoint for agent/scheduler access to the basket optimizer
- Short-lived in-memory quote cache to reduce provider fan-out pressure per serverless instance
- Installable PWA manifest and app icon for mobile access
- `DESIGN.md` source of truth using Google's agent-readable design format, validated with `@google/design.md`
- Command-center redesign focused on signals, proof, risk, trade tickets, and readiness instead of decorative dashboard cards
- Composite public quote feed using Nasdaq price/status, CNBC/Yahoo day range enrichment, Yahoo commodity futures aliases, Binance/Yahoo crypto, and Stooq fallback
- News feed through Yahoo Finance RSS first, then Benzinga, Finnhub, or NewsAPI when explicitly configured
- Add/remove watchlist symbols in the browser
- Ranking score based on trend, close location, range, and liquidity
- Interactive price map chart
- Paper-trade research journal saved locally and mirrored to SQL notes when `DATABASE_URL` is configured
- Agent desk showing how Codex, OpenClaw, Hermes, and KiloCode should split research work
- Risk constitution to prevent impulsive execution
- Demo-only fallback quotes when `DEMO_MARKET_DATA=true`; production live routes return unavailable instead of inventing prices
- Engine Fusion Map covering OpenBB, Alpha Vantage, Alphalens, Systematic Trading Map, OpenStock, StockSight, StreetMerchant alert ops, Ghostfolio, AKShare, TradingAgents, LSTM Time Series, LLM Trading Lab, StockPredictionAI, Stock Prediction Models, LEAN, StockSharp, RQAlpha, Freqtrade, backtesting.py, vectorbt, Backtrader, Nautilus Trader, FinRL, FinRL-Trading, FinGPT, and Jesse
- Quant Lab with first-pass strategy simulation inspired by lightweight and vectorized backtesting workflows
- Research Pipeline that promotes ideas from data collection to simple tests, parameter sweeps, event-driven simulation, NLP challenge checks, and paper/live gates
- `/api/engines` endpoint exposing the integrated engine catalog and guardrails
- Private access gate controlled by `ACCESS_CODE` or `TRADING_ACCESS_CODE`, plus `TRADING_ACCESS_TOKEN`
- `/api/health` endpoint showing provider readiness without exposing secrets
- Export/import backups for watchlist and paper-trade journal
- Market Signal Monitor that polls every 30 seconds, 1 minute, 2 minutes, or 5 minutes while the app is open
- Rule-based `Buy Watch`, `Sell/Exit Watch`, and `Hold/No Trade` alerts with confidence, invalidation, target, and risk cap
- Dedicated `Buy Lead - Wait for Trigger` ranking so the dashboard still shows the closest buy candidates when no symbol qualifies for an active buy watch
- Strict first-screen `Buy Now` gate that only promotes a symbol when fresh data, active trigger, confidence, reward/risk, and position sizing all pass
- Trade Ticket workflow that turns the selected buy lead into entry, stop, target, units, max loss, reward/risk, confirmations, and do-not-trade rules
- Local paper ticket tracking for simulated plans before broker paper execution is connected
- Browser notification support for active buy/sell-watch alerts
- `/api/signals` endpoint for server-side signal generation
- `/api/buy-now` endpoint for current buy-now candidates plus blocked near-misses and the exact blockers
- `/api/buy-leads` endpoint for ranked buy candidates with trigger, stop, target, confidence, source warnings, and session status
- `/api/trade-ticket` endpoint for server-generated planning tickets
- `/api/trust-ops` endpoint exposing the trustworthy-trading-operation proof matrix, live-tracked issue status, proof readiness, unresolved proof items, critical open items, and build order
- Stock, commodity ETF, commodity futures proxy, and crypto default watchlist including `GLD`, `SLV`, `USO`, `UNG`, `GOLD`, `SILVER`, `OIL`, `NATGAS`, `COPPER`, `CORN`, `WHEAT`, and `SOY`
- Day Trading Playbook covering VWAP continuation, opening-range breakout, failed breakout, exhaustion, commodity volatility gates, futures session/roll caution, and risk-first sizing
- Signal quality grades, setup labels, reward/risk, confirmations, and warnings
- `/api/playbook` endpoint exposing the strategy rulebook
- Top-of-dashboard buy-now board, live buy leads, and buy/sell leaderboard ranked by action, quality, confidence, and reward/risk
- Vercel cron monitor at `/api/monitor`, scheduled every 5 minutes
- Free browser notification path for active alerts, plus optional webhook, SMS through Twilio, and email through Resend
- `/api/readiness` endpoint for real-use infrastructure checks
- `/api/position-size` endpoint and dashboard position sizing calculator
- `/api/events` endpoint and event-risk calendar for stocks and commodity proxies
- Paper analytics summary from saved research notes
- Trust Matrix covering licensed data, durable outcome proof, paper trading, backtesting, database, broker sync, alerts, news/catalysts, model performance, security, and PWA readiness with every issue status live plus separate proof states, evidence standards, and acceptance criteria
- Plain-English `Right Now` board at the top of the dashboard
- `/api/now` endpoint that returns current buy-now candidates, top buy-watch, top buy lead, and sell/avoid-watch in simple language
- Provider adapter layer: free-first auto, Alpaca-ready, optional paid-first, composite public stocks, Nasdaq, CNBC, Yahoo commodity futures aliases, Yahoo unofficial, Stooq delayed, Binance public crypto
- Public quote adapters for Nasdaq and CNBC, with composite enrichment to avoid false weak signals when a provider has price but limited day-range fields
- `/api/providers` endpoint with data-quality labels
- `/api/research-workers/run` endpoint for dispatching heavy research jobs to configured external workers
- `/api/agent-trader/execute` endpoint for paper-only agent execution; live mode returns a manual-approval block with an order draft
- TradingView Lightweight Charts for the price map
- Crypto public-feed watchlist support for `BTCUSD` and `ETHUSD`
- Data-quality badges: `Execution Grade`, `Public Real-Time`, `Partial Market`, `Unofficial`, `Delayed`, `Offline`
- Sticky moving live ticker tape at the top of the app
- Blinking live pulse and seconds-since-refresh indicator
- Per-symbol ticker action labels: `BUY NOW`, `BUY WATCH`, `BUY LEAD`, `SELL / AVOID`, `HOLD`, `WAIT - STALE`, or `RESEARCH BUY`
- Vitest regression tests for input guards, position sizing, signal freshness, buy-now gating, and security helpers
- GitHub Actions CI for lint, tests, build, and high-severity audit checks

## Local Commands

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run quality
npm run worker:autoresearch
npm run worker:research
npm run worker:agent-paper
vercel --prod --yes
```

## Real-Use Setup

Required for private production use:

```bash
vercel env add ACCESS_CODE production
# Or use the legacy-compatible name:
# vercel env add TRADING_ACCESS_CODE production
vercel env add TRADING_ACCESS_TOKEN production
vercel --prod --yes
```

Optional provider keys are documented in `.env.example`.

Persistent storage requires applying `database/schema.sql` to a Postgres-compatible database and setting:

```bash
vercel env add DATABASE_URL production
vercel --prod --yes
```

Always-on monitoring uses `vercel.json` cron. Alerts are only sent when `SEND_MONITOR_ALERTS=true` and at least one alert channel is configured.

Broker execution setup is documented in [Broker Execution](docs/BROKER_EXECUTION.md). Paper mode should be tested before live mode. Live mode requires Alpaca live credentials, explicit live env gates, a per-order acknowledgement phrase, and database audit storage.

Free/no-license feeds are now the default for research and monitoring, but they are not equivalent to consolidated exchange feeds. The app labels each quote by quality so signal precision is not overstated.

## Production Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Runbook](docs/RUNBOOK.md)
- [Security Model](docs/SECURITY.md)
- [Market Data Policy](docs/DATA_POLICY.md)
- [Broker Execution](docs/BROKER_EXECUTION.md)
- [Ising Basket Optimizer](docs/ISING_OPTIMIZER.md)
- [Algorithm Council](docs/ALGORITHM_COUNCIL.md)
- [Institutional Gates](docs/INSTITUTIONAL_GATES.md)
- [Research Stack](docs/RESEARCH_STACK.md)
- [Systematic Trading Reference Map](docs/SYSTEMATIC_TRADING_REFERENCE_MAP.md)
- [Alpha Vantage Worker](docs/ALPHA_VANTAGE_WORKER.md)
- [Alphalens Worker](docs/ALPHALENS_WORKER.md)
- [OpenStock Worker](docs/OPENSTOCK_WORKER.md)
- [StockSight Worker](docs/STOCKSIGHT_WORKER.md)
- [StreetMerchant Worker](docs/STREETMERCHANT_WORKER.md)
- [Ghostfolio Worker](docs/GHOSTFOLIO_WORKER.md)
- [AKShare Worker](docs/AKSHARE_WORKER.md)
- [LLM Trading Lab Worker](docs/LLM_TRADING_LAB_WORKER.md)
- [StockSharp Worker](docs/STOCKSHARP_WORKER.md)
- [RQAlpha Worker](docs/RQALPHA_WORKER.md)
- [Freqtrade Worker](docs/FREQTRADE_WORKER.md)
- [LSTM Time Series Worker](docs/LSTM_TIME_SERIES_WORKER.md)
- [StockPredictionAI Worker](docs/STOCKPREDICTIONAI_WORKER.md)
- [Stock Prediction Models Worker](docs/STOCK_PREDICTION_MODELS_WORKER.md)
- [AutoResearch Lab](docs/AUTORESEARCH_LAB.md)
- [Agent Trading](docs/AGENT_TRADING.md)

## Data Notes

The app now prefers free alternatives before paid services. Paid/licensed feeds are still available as optional upgrades when execution-grade evidence is required. Implemented free-first paths and optional integrations:

- Public composite quote routing, Binance crypto, Yahoo futures aliases, and Stooq delayed data by default; Polygon.io or Twelve Data only when API keys are provided or paid-first mode is selected
- Yahoo Finance RSS by default; Benzinga, Finnhub, or NewsAPI only when API keys are provided or paid news mode is selected
- SEC EDGAR APIs for filings with no paid key required
- `LOCAL_LLM_BASE_URL` for a free/self-hosted OpenAI-compatible analyst chat model; `OPENAI_API_KEY` remains optional for paid cloud models
- Browser notifications as the free alert path; webhook, Twilio, and Resend are optional off-device channels
- OpenBB external worker hook for deeper fundamentals and macro workflows
- TradingAgents native debate desk for market, fundamentals, bull/bear researcher, trader, risk, and portfolio-manager review
- Systematic-trading reference map for free public research taxonomy and proof-lane coverage checks
- Alpha Vantage, Alphalens, OpenStock, StockSight, StreetMerchant, Ghostfolio, AKShare, LSTM Time Series, LLM Trading Lab, StockPredictionAI, Stock Prediction Models, LEAN, StockSharp, RQAlpha, Freqtrade, Backtrader, vectorbt, and Nautilus external worker hooks for free-account market data, factor proof, companion market workflows, sentiment/catalyst research, alert-loop operations, portfolio analytics, broader research data, agent research, crypto dry-run/backtest research, forecast research, and real historical backtests outside Vercel serverless limits
- FinGPT/FinRL worker hooks for research-only NLP and reinforcement-learning experiments
- Freqtrade and Jesse worker hooks for separate crypto paper/dry-run strategy lanes
- Postgres via `DATABASE_URL` for saved notes across devices; Supabase can be used when its Postgres connection string is supplied

## Risk Note

This platform is not financial advice and is not an autonomous trading system. Use it to organize research, test ideas, and enforce position-risk rules before any real-money decision.

The signal monitor is rule-based research output, not personalized investment advice. It does not place trades and should not be used as an execution-grade signal without licensed real-time data, paper validation, and your own risk review. No strategy or signal stack can guarantee high accuracy.
