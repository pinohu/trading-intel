# Institutional Gates

This layer turns the platform from a signal dashboard into an operating system with proof, controls, reconciliation, worker readiness, and compliance boundaries.

## Implemented APIs

| API | Purpose |
| --- | --- |
| `/api/institutional/readiness` | Aggregates proof, controls, worker readiness, and compliance boundary |
| `/api/proof/validation` | Scores proof gates and can persist model-validation reports |
| `/api/control-plane` | Reads/updates kill switch, paper/live permission, and order limits |
| `/api/broker/reconcile` | Reconciles Alpaca orders/activities and stores lifecycle events |
| `/api/catalysts` | Combines SEC filings, headlines, macro events, and commodity event calendars |
| `/api/options/volatility` | Builds options volatility context with quality labels |
| `/api/worker/readiness` | Reports persistent worker requirements |
| `/api/compliance/readiness` | Reports research/compliance boundary status |

## Persistent Tables

| Table | Use |
| --- | --- |
| `control_state` | Kill switch and execution limits |
| `model_validation_reports` | Proof gate history |
| `catalyst_events` | SEC/news/macro/commodity catalysts |
| `option_volatility_snapshots` | Options context snapshots |
| `broker_reconciliations` | Broker reconciliation run history |
| `broker_order_events` | Order lifecycle and reconciliation events |

## Current Production State

After deployment, the production smoke check showed:

- Database reachable and schema ready
- Institutional readiness passing
- Proof grade amber: 2 passed, 4 partial, 0 failed
- Control state stored with kill switch off, paper allowed, live disabled
- Fresh backtest run stored with holdout validation metadata
- Monitor run stored fresh signal snapshots
- Broker reconciliation endpoint working

## Still External

Some things cannot be manufactured in code:

- SIP/paid consolidated stock data entitlement for execution-grade promotion; free-first public feeds are already applied for research
- OPRA options entitlement; contract-only/indicative context remains partial without it
- CME/futures market data and futures broker execution; public aliases and ETF proxies remain research-only
- A persistent worker host if second-level monitoring and WebSocket `trade_updates` must run continuously; workers can be self-hosted when you have free/local compute
- Legal/compliance review before paid or personalized trading advice

## Worker Commands

```bash
node scripts/market-worker.mjs
node scripts/proof-worker.mjs
node scripts/alpaca-trade-updates-worker.mjs
```

## References

- [Alpaca Market Data API](https://docs.alpaca.markets/docs/about-market-data-api)
- [Alpaca Trading API Orders](https://docs.alpaca.markets/docs/orders-at-alpaca)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [CME Real-Time Quotes](https://www.cmegroup.com/market-data/real-time-quotes.html)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [SEC Automated Investment Advice](https://www.sec.gov/about/divisions-offices/office-strategic-hub-innovation-financial-technology-finhub/automated-investment-advice)
