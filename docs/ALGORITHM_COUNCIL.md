# Algorithm Council

The Algorithm Council is the platform's fundamental-information centric research layer. It combines official SEC CompanyFacts data, live quote context, accounting-risk screens, and factor-style ranking into a plain-English research recommendation.

It is designed to improve signal quality, not to promise profits. Any promoted idea still has to pass the trade ticket, risk controls, backtest evidence, paper-trade outcomes, and live-execution gates.

## Implemented Families

| Family | What It Adds | Current Implementation |
| --- | --- | --- |
| Fama-French style multi-factor core | Value, profitability, investment discipline, and factor ranking | Earnings yield, sales yield, book-to-market, profitability, asset growth, and balance-sheet discipline |
| Quality-minus-junk style quality | Separates durable businesses from fragile ones | Margins, free-cash-flow margin, debt/assets, Piotroski strength, and accrual quality |
| Piotroski F-score | Accounting strength for individual companies | Profitability, leverage/liquidity improvement, operating efficiency, and share issuance checks |
| Beneish/Sloan accounting risk | Avoids names where reported earnings quality is suspect | Beneish M-score risk bands plus accruals/assets penalty |
| Value + momentum ensemble | Avoids cheap-but-broken and hot-but-expensive single-signal mistakes | Fundamental score blended with intraday quote strength, range location, and liquidity |
| Risk-first portfolio gate | Keeps "interesting" ideas from becoming unsafe trades | Data freshness, provider quality, missing fundamentals, liquidity, and backtest/paper-trade reminders |

## Data Sources

| Source | Use | Notes |
| --- | --- | --- |
| SEC EDGAR CompanyFacts | Official fundamentals for public U.S. companies | Requires a real `SEC_USER_AGENT` in production |
| Alpaca market data | Live quote/tape context where credentials permit | Feed quality depends on the Alpaca subscription and exchange entitlements |
| Internal quote fallback providers | Degraded quote context | Useful for research continuity, not execution-grade certainty |
| Neon Postgres | Durable factor and fundamental snapshots | Tables: `fundamental_snapshots`, `factor_snapshots` |

## Output Fields

| Field | Meaning |
| --- | --- |
| `recommendation` | Plain research label: `Strong Buy Watch`, `Buy Watch`, `Hold/No Trade`, or `Avoid / Sell Watch` |
| `ensembleScore` | Weighted factor score after accounting-risk and data-coverage penalties |
| `confidence` | Score blended with data coverage, not a probability of profit |
| `factorScores` | Individual factor scores with rationales |
| `thesis` | Plain-English bullish case |
| `bearCase` | Most important caution from the current data |
| `riskControls` | Required checks before any trade promotion |
| `fundamentals[SYMBOL].provenance` | Filing-period basis, latest/prior fiscal years, filed dates, source limitations, and point-in-time caveat |

## Production Caveats

- SEC fundamentals are not second-by-second data. They are official, but periodic.
- CompanyFacts live snapshots now store period provenance, but historical backtests must still enforce filed-date as-of rules to avoid lookahead bias.
- Commodity futures need licensed futures data, contract calendars, roll handling, and term-structure logic before they can be treated like execution-grade commodities.
- The council must be evaluated by stored outcomes: 5m, 15m, 1h, 1d, and multi-day follow-through.
- Live execution must stay gated behind account sync, risk limits, order preview, audit logging, and explicit mode controls.

## References

- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Alpaca Market Data API](https://docs.alpaca.markets/docs/about-market-data-api)
- [Kenneth French Data Library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html)
- [Fama-French 5 Factors](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/f-f_5_factors_2x3.html)
- [AQR Quality Minus Junk](https://www.aqr.com/-/media/AQR/Documents/Insights/Working-Papers/Quality-Minus-Junk.pdf)
- [Value and Momentum Everywhere](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1363476)
- [Event Studies in Economics and Finance](https://www.bu.edu/econ/files/2011/01/MacKinlay-1996-Event-Studies-in-Economics-and-Finance.pdf)
- [Empirical Asset Pricing via Machine Learning](https://academic.oup.com/rfs/article/33/5/2223/5758276)
