export type ReferenceReportLesson = {
  key: string;
  title: string;
  source: string;
  lesson: string;
  systemRule: string;
  category: "data" | "risk" | "execution" | "research" | "operations" | "security";
};

export const minimumReferenceRewardRisk = 1.5;

export const referenceReportLessons: ReferenceReportLesson[] = [
  {
    key: "architecture",
    title: "Architecture",
    source: "docs/ARCHITECTURE.md",
    lesson: "The dashboard is a research and guarded broker-operations cockpit; real-money agent trading must be explicitly armed, acknowledged, and audited.",
    systemRule: "Every promoted idea must keep data, ticket, proof, broker, and audit boundaries visible.",
    category: "operations",
  },
  {
    key: "production-trading-ops",
    title: "Production Trading Operations",
    source: "docs/PRODUCTION_TRADING_OPS.md",
    lesson: "Live orders require broker credentials, live acknowledgement, audit storage, pre-trade controls, and kill-switch clearance.",
    systemRule: "Live mode stays gated even when paper execution is ready; agent live orders require live-agent arming plus per-order acknowledgement.",
    category: "execution",
  },
  {
    key: "broker-execution",
    title: "Broker Execution",
    source: "docs/BROKER_EXECUTION.md",
    lesson: "The broker rail allows authenticated day limit orders only, with whole-share stock/ETF constraints and live acknowledgement.",
    systemRule: "Trade tickets must expose entry, stop, target, quantity, notional, max loss, and live gate state before submission.",
    category: "execution",
  },
  {
    key: "agent-trading",
    title: "Agent Trading",
    source: "docs/AGENT_TRADING.md",
    lesson: "Agents may draft, paper-submit, or submit live-money orders only when the operator arms live-agent controls and acknowledges the exact live order request.",
    systemRule: "Agent output must stay visible at ticket level and can execute live only through the logged-in, audited, acknowledged broker rail.",
    category: "execution",
  },
  {
    key: "data-policy",
    title: "Market Data Policy",
    source: "docs/DATA_POLICY.md",
    lesson: "Production must never invent market data; stale or public-only feeds should not be treated as execution-grade proof.",
    systemRule: "Buy-now promotion requires fresh data and quality labels; unavailable data blocks action.",
    category: "data",
  },
  {
    key: "research-stack",
    title: "Research Stack",
    source: "docs/RESEARCH_STACK.md",
    lesson: "Use credentialed providers first, public fallbacks second, native engines for bounded tasks, and external workers for heavy research.",
    systemRule: "Fusion scoring should show which lanes are active, proxy, missing, or blocked.",
    category: "research",
  },
  {
    key: "alpha-vantage",
    title: "Alpha Vantage Reference",
    source: "https://github.com/RomelTorres/alpha_vantage",
    lesson: "Alpha Vantage can broaden free-account research with time series, indicators, fundamentals, FX, crypto, and economic data, but rate limits and provider warnings must be surfaced.",
    systemRule: "Alpha Vantage output is research data only until source freshness, rate-limit status, data quality, and execution-grade confirmation pass; worker output cannot place or authorize broker orders.",
    category: "data",
  },
  {
    key: "alphalens",
    title: "Alphalens Reference",
    source: "https://github.com/quantopian/alphalens",
    lesson: "Alphalens-style factor analysis turns raw alpha scores into forward-return, information-coefficient, turnover, grouped, and quantile-spread evidence before a signal is trusted.",
    systemRule: "Factor evidence can raise confidence only when IC, forward returns, turnover, costs, freshness, and paper outcomes agree; Alphalens output cannot authorize broker orders.",
    category: "research",
  },
  {
    key: "awesome-systematic-trading",
    title: "Awesome Systematic Trading Reference",
    source: "https://github.com/wangzhe3224/awesome-systematic-trading",
    lesson: "Systematic trading maturity requires separate tracks for data, alpha strategy, trading analytics, backtesting, live trading, architecture, tooling, research resources, and AI/LLM challenge work.",
    systemRule: "Use the systematic-trading map as a coverage checklist only; it can reveal missing proof lanes but cannot become a signal, market-data source, or execution engine.",
    category: "research",
  },
  {
    key: "openstock",
    title: "OpenStock Reference",
    source: "https://github.com/Open-Dev-Society/OpenStock",
    lesson: "OpenStock provides open market-app patterns for search, watchlists, company insights, news/context surfaces, alerts, and auth-backed personal workflows.",
    systemRule: "Use OpenStock as a self-hosted companion/reference lane; do not copy AGPL source into this app without accepting the license obligations.",
    category: "operations",
  },
  {
    key: "stocksight",
    title: "StockSight Reference",
    source: "https://github.com/shirosaidev/stocksight",
    lesson: "StockSight-style sentiment research can mine Twitter, news headlines, linked pages, polarity, subjectivity, and Kibana-reviewable evidence, but social/news tone is noisy and source-dependent.",
    systemRule: "StockSight output can challenge or contextualize a catalyst only when source count, timestamps, polarity, subjectivity, and collection limits are visible; it cannot become market data or authorize broker orders.",
    category: "research",
  },
  {
    key: "streetmerchant",
    title: "StreetMerchant Reference",
    source: "https://github.com/jef/streetmerchant",
    lesson: "StreetMerchant is a retail inventory stock monitor, not a financial-equity data source; its useful lessons are persistent watch loops, store/source matrices, notification fanout, cooldowns, and manual purchase boundaries.",
    systemRule: "StreetMerchant-style output can only harden alert operations; it must never be treated as market data, a buy/sell signal, or authorization for broker execution.",
    category: "operations",
  },
  {
    key: "ghostfolio",
    title: "Ghostfolio Reference",
    source: "https://github.com/ghostfolio/ghostfolio",
    lesson: "Ghostfolio-style portfolio analytics add performance, allocation, holdings, transactions, import/export, and static risk context around trade ideas.",
    systemRule: "Portfolio analytics should challenge every new trade against account-level exposure, concentration, and existing holdings; do not copy AGPL source into this app without accepting the license obligations.",
    category: "risk",
  },
  {
    key: "akshare",
    title: "AKShare Reference",
    source: "https://github.com/akfamily/akshare",
    lesson: "AKShare expands free Python research access across China/Asia markets, macro, funds, futures, bonds, options, and reference datasets, with upstream data limitations that must be labeled.",
    systemRule: "AKShare data can enrich research coverage but must remain labeled research data until freshness, source quality, and execution-grade confirmation pass.",
    category: "data",
  },
  {
    key: "algorithm-council",
    title: "Algorithm Council",
    source: "docs/ALGORITHM_COUNCIL.md",
    lesson: "Fundamentals, quality, value, momentum, accounting risk, and data coverage improve signal quality but still need proof gates.",
    systemRule: "Factor evidence can support a thesis, but trade promotion still needs a ticket, backtest, paper outcomes, and risk controls.",
    category: "research",
  },
  {
    key: "institutional-gates",
    title: "Institutional Gates",
    source: "docs/INSTITUTIONAL_GATES.md",
    lesson: "Proof, controls, worker readiness, broker reconciliation, and compliance boundaries convert signals into operations.",
    systemRule: "Control-plane runs must include stage evidence and block execution when risk review fails.",
    category: "operations",
  },
  {
    key: "autoresearch-lab",
    title: "AutoResearch Lab",
    source: "docs/AUTORESEARCH_LAB.md",
    lesson: "Automated experiments are research-only until out-of-sample proof, paper trading, costs, ticket shape, and human review agree.",
    systemRule: "Autoresearch results can strengthen confidence, but cannot bypass paper/live gates.",
    category: "research",
  },
  {
    key: "ising-optimizer",
    title: "Ising Basket Optimizer",
    source: "docs/ISING_OPTIMIZER.md",
    lesson: "The optimizer selects among existing candidates under budget, risk, max-position, and overlap limits; it does not predict price.",
    systemRule: "Basket selection must inherit freshness, ticket, risk, and tradeability constraints from each candidate.",
    category: "risk",
  },
  {
    key: "runbook",
    title: "Production Runbook",
    source: "docs/RUNBOOK.md",
    lesson: "Health, persistence, broker, market-data, auth, cron, and TradingAgents checks are operational prerequisites.",
    systemRule: "Operational readiness should remain visible next to trade decisions.",
    category: "operations",
  },
  {
    key: "security",
    title: "Security Model",
    source: "docs/SECURITY.md",
    lesson: "Private access, rate limits, session cookies, query guards, cron secrets, and audit events are required before broker operations.",
    systemRule: "Broker routes stay user-session-only and never fail open.",
    category: "security",
  },
  {
    key: "ai-trader",
    title: "AI-Trader Reference",
    source: "external-repos/AI-Trader/README.md",
    lesson: "Agent-native trading systems benefit from collective signal pressure and paper/live separation.",
    systemRule: "Agent consensus should raise or lower confidence, not replace ticket-level risk approval.",
    category: "research",
  },
  {
    key: "stockpredictionai",
    title: "StockPredictionAI Reference",
    source: "https://github.com/borisbanushev/stockpredictionai",
    lesson: "Deep stock forecasts can combine technical indicators, sentiment, Fourier/ARIMA trend features, XGBoost importance, autoencoders, PCA, and GAN/LSTM/CNN models, but they are vulnerable to overfit and dependency drift.",
    systemRule: "StockPredictionAI-style output is research pressure only until holdout proof, cost/slippage tests, data freshness, and risk gates agree; do not vendor unlicensed source code without legal review.",
    category: "research",
  },
  {
    key: "lstm-time-series",
    title: "LSTM Time Series Reference",
    source: "https://github.com/jaungiers/LSTM-Neural-Network-for-Time-Series-Prediction",
    lesson: "A narrow LSTM sequence forecast can be useful as a baseline when sequence length, train/test split, walk-forward validation, benchmark comparison, and dependency age are explicit.",
    systemRule: "LSTM time-series output is research pressure only until holdout proof, slippage/fee costs, freshness labels, benchmark comparison, and risk gates agree; do not copy AGPL source into this app without accepting license obligations.",
    category: "research",
  },
  {
    key: "llm-trading-lab",
    title: "LLM Trading Lab Reference",
    source: "https://github.com/LuckyOne7777/LLM-Trading-Lab",
    lesson: "LLM trading experiments become useful when they keep forward-only daily decision logs, hard constraints, stop-loss compliance, portfolio metrics, and benchmark comparisons visible.",
    systemRule: "LLM Trading Lab output is research pressure only until audit logs, constraints, paper outcomes, stop-loss behavior, and risk controls agree; do not vendor unlicensed source code without legal review.",
    category: "research",
  },
  {
    key: "stock-prediction-models",
    title: "Stock Prediction Models Reference",
    source: "https://github.com/huseinzol05/Stock-Prediction-Models",
    lesson: "Archived ML model-zoo projects can broaden forecast research with deep learning, stacking, simulations, and agent experiments, but dependencies and notebooks require modern holdout validation before trust.",
    systemRule: "Stock Prediction Models output is research pressure only until reproduced on current data with holdout proof, slippage/fee costs, freshness labels, and risk gates.",
    category: "research",
  },
  {
    key: "rqalpha",
    title: "RQAlpha Reference",
    source: "https://github.com/ricequant/rqalpha",
    lesson: "RQAlpha-style strategy proof should expose event-driven simulation, Mod-based risk checks, scheduled logic, transaction-cost assumptions, fills, holdings, portfolio records, and analyser metrics.",
    systemRule: "RQAlpha worker output is research pressure only until simulated orders, costs, risk checks, walk-forward proof, and paper outcomes agree; respect the non-commercial license boundary and do not route worker output to broker orders.",
    category: "research",
  },
  {
    key: "vibe-trading",
    title: "Vibe-Trading Reference",
    source: "external-repos/Vibe-Trading/README.md",
    lesson: "Multi-agent strategy work should turn natural-language ideas into testable strategies, journals, backtests, and exportable reports.",
    systemRule: "The cockpit should present plain-language entry requirements plus quantified stop, target, and sizing.",
    category: "research",
  },
  {
    key: "fincept-terminal",
    title: "Fincept Terminal Reference",
    source: "external-repos/FinceptTerminal/README.md",
    lesson: "Professional finance terminals combine analytics, data connectors, portfolio risk, news, agents, and visual workflows.",
    systemRule: "Live presentation should make data, portfolio exposure, catalyst context, and order lifecycle state scannable.",
    category: "operations",
  },
  {
    key: "kronos",
    title: "Kronos Reference",
    source: "external-repos/Kronos/README.md",
    lesson: "Market-model forecasts need task-specific data handling and should be treated as research evidence, not guaranteed signals.",
    systemRule: "Forecast-like evidence should be weighted behind freshness, validation, and risk controls.",
    category: "research",
  },
];

export function referenceReportSummary() {
  const categories = referenceReportLessons.reduce<Record<ReferenceReportLesson["category"], number>>(
    (counts, lesson) => {
      counts[lesson.category] += 1;
      return counts;
    },
    { data: 0, risk: 0, execution: 0, research: 0, operations: 0, security: 0 },
  );
  return {
    total: referenceReportLessons.length,
    categories,
    appliedRules: referenceReportLessons.map((lesson) => lesson.systemRule),
  };
}

export function executionReferenceChecklist() {
  return [
    `Reward/risk must be at least ${minimumReferenceRewardRisk}R before buy-now promotion.`,
    "Entry trigger, stop, target, unit size, notional size, max loss, and entry signal must be visible.",
    "Live execution requires live-agent arming when agent-submitted, acknowledgement, audit storage, and pre-trade controls.",
    "Public or stale market data blocks live-quality promotion.",
    "Agent, optimizer, and forecast evidence cannot bypass the ticket or risk reviewer.",
  ];
}
