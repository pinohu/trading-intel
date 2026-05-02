export type EngineCapability = {
  repo: string;
  productName: string;
  lane: string;
  bestUse: string;
  featureUnlocked: string;
  integrationMode: "Native UI" | "Python worker" | "External engine" | "Research sandbox";
  safety: "Research" | "Paper trading" | "Live capable, gated";
  priority: "Now" | "Next" | "Later";
};

export const engineCapabilities: EngineCapability[] = [
  {
    repo: "OpenBB-finance/OpenBB",
    productName: "OpenBB Data Terminal",
    lane: "Market data",
    bestUse: "Market data, fundamentals, options chains, macro context, and CLI/Python research.",
    featureUnlocked: "Multi-source data terminal, research snapshots, macro/fundamental enrichment, options hooks.",
    integrationMode: "Python worker",
    safety: "Research",
    priority: "Next",
  },
  {
    repo: "TauricResearch/TradingAgents",
    productName: "TradingAgents Debate Desk",
    lane: "Multi-agent research",
    bestUse: "LLM analyst, bull/bear researcher, trader, risk, and portfolio-manager debate before any paper-trade promotion.",
    featureUnlocked: "Structured research-only decisions, thesis/risk notes, and portfolio-manager challenges persisted to the research journal.",
    integrationMode: "Python worker",
    safety: "Research",
    priority: "Now",
  },
  {
    repo: "QuantConnect/Lean",
    productName: "LEAN Engine Bridge",
    lane: "Institutional backtesting",
    bestUse: "Serious algorithm research, paper trading, brokerage adapters, and reproducible strategy runs.",
    featureUnlocked: "Professional backtest/paper/live architecture with strict promotion gates.",
    integrationMode: "External engine",
    safety: "Live capable, gated",
    priority: "Later",
  },
  {
    repo: "kernc/backtesting.py",
    productName: "Simple Backtest Lab",
    lane: "Fast validation",
    bestUse: "Lightweight stock and ETF strategy testing before using heavier engines.",
    featureUnlocked: "Phone-friendly first-pass backtests: moving-average, breakout, mean-reversion, drawdown checks.",
    integrationMode: "Native UI",
    safety: "Research",
    priority: "Now",
  },
  {
    repo: "polakowo/vectorbt",
    productName: "Vector Sweep Lab",
    lane: "Parameter research",
    bestUse: "Fast vectorized testing across many symbols and parameter combinations.",
    featureUnlocked: "Grid-search heatmaps, parameter sweeps, robustness checks, and overfit warnings.",
    integrationMode: "Python worker",
    safety: "Research",
    priority: "Next",
  },
  {
    repo: "mementum/backtrader",
    productName: "Backtrader Classic",
    lane: "Simulation",
    bestUse: "Mature strategy simulations, order models, broker abstractions, and learning workflows.",
    featureUnlocked: "Classic event-driven simulation lane for comparing results against LEAN and simple tests.",
    integrationMode: "Python worker",
    safety: "Paper trading",
    priority: "Later",
  },
  {
    repo: "nautechsystems/nautilus_trader",
    productName: "Nautilus Production Rail",
    lane: "Advanced execution infra",
    bestUse: "Production-grade event-driven trading infrastructure for serious live systems.",
    featureUnlocked: "Future hardened execution architecture, adapter model, and operational readiness checklist.",
    integrationMode: "External engine",
    safety: "Live capable, gated",
    priority: "Later",
  },
  {
    repo: "AI4Finance-Foundation/FinRL",
    productName: "FinRL Research Sandbox",
    lane: "AI strategy research",
    bestUse: "Reinforcement-learning experiments and agent policy research.",
    featureUnlocked: "RL experiment tracker with overfit warnings, paper-only controls, and benchmark comparisons.",
    integrationMode: "Research sandbox",
    safety: "Research",
    priority: "Later",
  },
  {
    repo: "AI4Finance-Foundation/FinRL-Trading",
    productName: "FinRL-Trading Pipeline",
    lane: "AI-native quant infra",
    bestUse: "Modern AI quant pipeline experiments and paper-trading research infrastructure.",
    featureUnlocked: "AI-native pipeline map for data, feature engineering, model training, and paper validation.",
    integrationMode: "Research sandbox",
    safety: "Research",
    priority: "Later",
  },
  {
    repo: "AI4Finance-Foundation/FinGPT",
    productName: "FinGPT Sentiment Desk",
    lane: "Financial NLP",
    bestUse: "Financial news, filings, and social sentiment analysis.",
    featureUnlocked: "Headline sentiment, catalyst extraction, thesis contradiction checks, and source confidence.",
    integrationMode: "Research sandbox",
    safety: "Research",
    priority: "Next",
  },
  {
    repo: "jesse-ai/jesse",
    productName: "Jesse Crypto Lab",
    lane: "Crypto strategy",
    bestUse: "Crypto strategy research, exchange simulation, and crypto-specific paper workflows.",
    featureUnlocked: "Separate crypto strategy lane with exchange-aware assumptions and paper-first controls.",
    integrationMode: "External engine",
    safety: "Paper trading",
    priority: "Later",
  },
];

export const engineWorkflow = [
  "Collect data with OpenBB-style connectors and current quote/news APIs.",
  "Challenge interesting tickers with TradingAgents multi-agent debate before writing a trade thesis.",
  "Run simple first-pass validation in the native Backtest Lab.",
  "Stress-test parameters with a vectorbt-style sweep before trusting a setup.",
  "Promote only robust ideas to LEAN or Backtrader for event-driven simulation.",
  "Use FinGPT-style NLP to challenge the thesis with sentiment, filings, and contradiction checks.",
  "Keep FinRL, FinRL-Trading, Nautilus, and Jesse behind paper/live gates until broker keys and risk controls exist.",
];
