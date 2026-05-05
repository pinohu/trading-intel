import { databaseConfigured } from "@/lib/db";
import { cleanSecret } from "@/lib/security";

export type ResearchStackComponent = {
  key: string;
  label: string;
  category: "market-data" | "news" | "filings" | "fundamentals" | "portfolio" | "backtesting" | "ai-research" | "crypto" | "operations" | "database";
  ready: boolean;
  mode: "credentialed" | "free-fallback" | "worker" | "native" | "missing";
  costProfile: "free-default" | "free-public" | "free-self-hosted" | "free-account" | "optional-paid";
  env: string[];
  detail: string;
  freeAlternative?: string;
  docs: string;
};

export type FreeReplacement = {
  replaces: string;
  freePath: string;
  applied: boolean;
  limitation: string;
};

export type ResearchStackReadiness = {
  ok: boolean;
  grade: "production-path" | "research-ready" | "partial";
  configured: number;
  total: number;
  criticalConfigured: number;
  criticalTotal: number;
  components: ResearchStackComponent[];
  freeReplacements: FreeReplacement[];
  workerCommands: Array<{
    name: string;
    purpose: string;
    command: string;
    urlEnv: string;
  }>;
  missingExternalEntitlements: string[];
};

function hasEnv(name: string) {
  return Boolean(cleanSecret(process.env[name]));
}

function workerReady(name: string) {
  return hasEnv(name);
}

export function buildResearchStackReadiness(): ResearchStackReadiness {
  const components: ResearchStackComponent[] = [
    {
      key: "alpaca",
      label: "Alpaca market + broker APIs",
      category: "market-data",
      ready: hasEnv("ALPACA_API_KEY_ID") && hasEnv("ALPACA_API_SECRET_KEY"),
      mode: hasEnv("ALPACA_API_KEY_ID") && hasEnv("ALPACA_API_SECRET_KEY") ? "credentialed" : "missing",
      costProfile: "free-account",
      env: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "ALPACA_DATA_QUALITY"],
      detail: "Stocks bars/snapshots, account read-only sync, paper/live broker routes, options and crypto endpoints when entitled.",
      freeAlternative: "Default no-key market data now uses the public composite quote stack; Alpaca Basic IEX is a free-account upgrade, while SIP remains optional.",
      docs: "https://docs.alpaca.markets/",
    },
    {
      key: "polygon",
      label: "Polygon.io stock snapshots",
      category: "market-data",
      ready: hasEnv("POLYGON_API_KEY"),
      mode: hasEnv("POLYGON_API_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["POLYGON_API_KEY"],
      detail: "Preferred stock snapshot adapter when the key and market-data entitlements exist.",
      freeAlternative: "Composite public stock quote, Nasdaq/CNBC public quote, Yahoo chart, and Stooq delayed are the default free path.",
      docs: "https://polygon.io/docs/rest/stocks/snapshots",
    },
    {
      key: "twelvedata",
      label: "Twelve Data quotes",
      category: "market-data",
      ready: hasEnv("TWELVE_DATA_API_KEY"),
      mode: hasEnv("TWELVE_DATA_API_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["TWELVE_DATA_API_KEY"],
      detail: "Optional quote adapter for equities, ETFs, forex, and crypto depending on plan.",
      freeAlternative: "Composite public stocks, Binance public crypto, Yahoo charts/futures aliases, and Stooq delayed quotes.",
      docs: "https://twelvedata.com/docs",
    },
    {
      key: "public-market-fallbacks",
      label: "Public market fallbacks",
      category: "market-data",
      ready: true,
      mode: "free-fallback",
      costProfile: "free-default",
      env: [],
      detail: "Nasdaq/CNBC/Yahoo/Stooq/Binance keep the dashboard alive as the default free-first research feed.",
      docs: "https://stooq.com/",
    },
    {
      key: "benzinga",
      label: "Benzinga structured news",
      category: "news",
      ready: hasEnv("BENZINGA_API_KEY"),
      mode: hasEnv("BENZINGA_API_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["BENZINGA_API_KEY"],
      detail: "Structured market news, catalysts, and ticker-tagged headlines when licensed.",
      freeAlternative: "Yahoo Finance RSS, SEC EDGAR filings, and the built-in event-risk calendar now run first by default.",
      docs: "https://docs.benzinga.com/",
    },
    {
      key: "finnhub",
      label: "Finnhub company news",
      category: "news",
      ready: hasEnv("FINNHUB_API_KEY"),
      mode: hasEnv("FINNHUB_API_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["FINNHUB_API_KEY"],
      detail: "Company news endpoint for ticker-specific catalyst context.",
      freeAlternative: "Yahoo Finance RSS, SEC EDGAR filings, and catalyst rules now cover the free path.",
      docs: "https://finnhub.io/docs/api",
    },
    {
      key: "newsapi",
      label: "NewsAPI article search",
      category: "news",
      ready: hasEnv("NEWSAPI_API_KEY"),
      mode: hasEnv("NEWSAPI_API_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["NEWSAPI_API_KEY"],
      detail: "Broad article search for additional source triangulation.",
      freeAlternative: "Yahoo Finance RSS plus official SEC filings and scheduled event-risk rules.",
      docs: "https://newsapi.org/docs/endpoints/everything",
    },
    {
      key: "sec-edgar",
      label: "SEC EDGAR filings",
      category: "filings",
      ready: true,
      mode: "free-fallback",
      costProfile: "free-public",
      env: ["SEC_USER_AGENT"],
      detail: "Free official filings through data.sec.gov submissions and company facts APIs.",
      docs: "https://data.sec.gov/",
    },
    {
      key: "openbb",
      label: "OpenBB worker",
      category: "fundamentals",
      ready: workerReady("OPENBB_WORKER_URL"),
      mode: workerReady("OPENBB_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["OPENBB_WORKER_URL"],
      detail: "External Python worker for deeper fundamentals, macro series, options context, and provider-key orchestration.",
      freeAlternative: "Native SEC company facts, factor screens, public quote context, and self-hosted OpenBB when compute is available.",
      docs: "https://docs.openbb.co/",
    },
    {
      key: "openstock",
      label: "OpenStock companion worker",
      category: "market-data",
      ready: workerReady("OPENSTOCK_WORKER_URL"),
      mode: workerReady("OPENSTOCK_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["OPENSTOCK_WORKER_URL"],
      detail: "External AGPL-licensed companion app lane for stock search, watchlists, company insights, market/news context, alerts, and UX comparison without vendoring source.",
      freeAlternative: "Native dashboard search/watchlist/news and public quote stack remain available; self-host OpenStock when you want its companion market-app workflow.",
      docs: "https://github.com/Open-Dev-Society/OpenStock",
    },
    {
      key: "streetmerchant",
      label: "StreetMerchant alert-pattern worker",
      category: "operations",
      ready: workerReady("STREETMERCHANT_WORKER_URL"),
      mode: workerReady("STREETMERCHANT_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["STREETMERCHANT_WORKER_URL"],
      detail: "External MIT-licensed alert-operations worker inspired by jef/streetmerchant for 24/7 watch loops, dashboard matrices, notification fanout, cooldown discipline, and manual-action guardrails. It is retail-inventory stock monitoring, not equity market data.",
      freeAlternative: "Native monitor scans, SQL alert events, browser notifications, webhook, Twilio, and Resend remain available; self-host StreetMerchant-style checks only to harden alert-loop operations.",
      docs: "https://github.com/jef/streetmerchant",
    },
    {
      key: "ghostfolio",
      label: "Ghostfolio portfolio worker",
      category: "portfolio",
      ready: workerReady("GHOSTFOLIO_WORKER_URL"),
      mode: workerReady("GHOSTFOLIO_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["GHOSTFOLIO_WORKER_URL"],
      detail: "External AGPL-licensed companion wealth app lane for portfolio performance, holdings composition, static risk analysis, transaction history, and multi-account context without vendoring source.",
      freeAlternative: "Native Alpaca portfolio/risk routes remain available; self-host Ghostfolio when you want a broader personal finance portfolio source of truth.",
      docs: "https://github.com/ghostfolio/ghostfolio",
    },
    {
      key: "akshare",
      label: "AKShare data worker",
      category: "market-data",
      ready: workerReady("AKSHARE_WORKER_URL"),
      mode: workerReady("AKSHARE_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["AKSHARE_WORKER_URL"],
      detail: "MIT-licensed Python data worker for China/Asia markets, macro data, funds, futures, bonds, options, and reference datasets.",
      freeAlternative: "Native public quote stack remains the default; self-host AKShare when broader non-US research data is needed.",
      docs: "https://github.com/akfamily/akshare",
    },
    {
      key: "tradingagents",
      label: "TradingAgents native debate desk",
      category: "ai-research",
      ready: true,
      mode: "native",
      costProfile: "free-default",
      env: [],
      detail: "In-code analyst, bull/bear researcher, trader, risk, and portfolio-manager debate using current quotes, SEC/factor evidence, rule signals, and native backtests.",
      docs: "https://github.com/TauricResearch/TradingAgents",
    },
    {
      key: "local-llm",
      label: "Local OpenAI-compatible analyst LLM",
      category: "ai-research",
      ready: hasEnv("LOCAL_LLM_BASE_URL"),
      mode: hasEnv("LOCAL_LLM_BASE_URL") ? "free-fallback" : "missing",
      costProfile: "free-self-hosted",
      env: ["LOCAL_LLM_BASE_URL", "LOCAL_LLM_MODEL", "LOCAL_LLM_API_KEY"],
      detail: "Analyst chat tries a self-hosted OpenAI-compatible endpoint before paid cloud LLMs when LOCAL_LLM_BASE_URL is configured.",
      freeAlternative: "Ollama/LM Studio/vLLM-style local endpoints; deterministic cockpit fallback remains available without any LLM key.",
      docs: "https://docs.ollama.com/openai",
    },
    {
      key: "stockpredictionai",
      label: "StockPredictionAI forecast worker",
      category: "ai-research",
      ready: workerReady("STOCKPREDICTIONAI_WORKER_URL"),
      mode: workerReady("STOCKPREDICTIONAI_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["STOCKPREDICTIONAI_WORKER_URL"],
      detail: "External research-only worker inspired by borisbanushev/stockpredictionai: GAN/LSTM generator, CNN discriminator, technical indicators, sentiment, Fourier/ARIMA, XGBoost, autoencoder, and PCA feature ideas.",
      freeAlternative: "Native Fusion Alpha, TradingAgents, Algorithm Council, and cost-aware backtests remain available when this heavy GPU/ML worker is absent.",
      docs: "https://github.com/borisbanushev/stockpredictionai",
    },
    {
      key: "lstmtimeseries",
      label: "LSTM Time Series forecast worker",
      category: "ai-research",
      ready: workerReady("LSTM_TIME_SERIES_WORKER_URL"),
      mode: workerReady("LSTM_TIME_SERIES_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["LSTM_TIME_SERIES_WORKER_URL"],
      detail: "External AGPL-licensed research worker inspired by jaungiers/LSTM-Neural-Network-for-Time-Series-Prediction for Keras LSTM sequence forecasts, stock time-series samples, holdout diagnostics, and old dependency-risk labeling.",
      freeAlternative: "Native Fusion Alpha, TradingAgents, Algorithm Council, and cost-aware backtests remain available; self-host this only as a sequence-model baseline and modernization exercise.",
      docs: "https://github.com/jaungiers/LSTM-Neural-Network-for-Time-Series-Prediction",
    },
    {
      key: "llmtradinglab",
      label: "LLM Trading Lab worker",
      category: "ai-research",
      ready: workerReady("LLM_TRADING_LAB_WORKER_URL"),
      mode: workerReady("LLM_TRADING_LAB_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["LLM_TRADING_LAB_WORKER_URL"],
      detail: "External research-only worker inspired by LuckyOne7777/LLM-Trading-Lab for forward-only LLM trading decisions, hard constraints, stop-loss compliance, portfolio logs, and benchmark metrics.",
      freeAlternative: "Native TradingAgents debate, control-plane runs, and paper/live gates remain available when this LLM lab worker is absent.",
      docs: "https://github.com/LuckyOne7777/LLM-Trading-Lab",
    },
    {
      key: "stockpredictionmodels",
      label: "Stock Prediction Models worker",
      category: "ai-research",
      ready: workerReady("STOCK_PREDICTION_MODELS_WORKER_URL"),
      mode: workerReady("STOCK_PREDICTION_MODELS_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["STOCK_PREDICTION_MODELS_WORKER_URL"],
      detail: "External Apache-2.0 research worker inspired by huseinzol05/Stock-Prediction-Models: deep learning forecasts, simulations, stacking, agent experiments, and TensorFlow.js-style model demos.",
      freeAlternative: "Native Fusion Alpha, TradingAgents, Algorithm Council, and cost-aware backtests remain available when this archived ML worker is absent.",
      docs: "https://github.com/huseinzol05/Stock-Prediction-Models",
    },
    {
      key: "lean",
      label: "QuantConnect LEAN worker",
      category: "backtesting",
      ready: workerReady("LEAN_WORKER_URL"),
      mode: workerReady("LEAN_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["LEAN_WORKER_URL"],
      detail: "External event-driven backtest/paper/live engine path outside Vercel limits.",
      freeAlternative: "Native cost-aware daily-bar backtest and bounded AutoResearch lab.",
      docs: "https://www.quantconnect.com/docs/v2/lean-cli",
    },
    {
      key: "stocksharp",
      label: "StockSharp C# worker",
      category: "backtesting",
      ready: workerReady("STOCKSHARP_WORKER_URL"),
      mode: workerReady("STOCKSHARP_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["STOCKSHARP_WORKER_URL"],
      detail: "External Apache-2.0 C#/.NET worker for StockSharp connector research, multi-market strategy tests, and broker-adapter simulations.",
      freeAlternative: "Self-host StockSharp beside the app; native cost-aware backtests remain available when the worker is absent.",
      docs: "https://github.com/StockSharp/StockSharp",
    },
    {
      key: "rqalpha",
      label: "RQAlpha backtest worker",
      category: "backtesting",
      ready: workerReady("RQALPHA_WORKER_URL"),
      mode: workerReady("RQALPHA_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["RQALPHA_WORKER_URL"],
      detail: "External non-commercial RQAlpha Python worker for event-driven backtests, simulated fills, risk pre-checks, transaction-cost models, analyser output, and Mod-style extension pressure.",
      freeAlternative: "Native cost-aware backtests remain the default; self-host RQAlpha only when its event model and analyser reports add research proof.",
      docs: "https://github.com/ricequant/rqalpha",
    },
    {
      key: "backtrader",
      label: "Backtrader worker",
      category: "backtesting",
      ready: workerReady("BACKTRADER_WORKER_URL"),
      mode: workerReady("BACKTRADER_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["BACKTRADER_WORKER_URL"],
      detail: "Classic Python event-driven simulation lane for cross-checking simple/native results.",
      freeAlternative: "Native cost-aware daily-bar backtest.",
      docs: "https://www.backtrader.com/",
    },
    {
      key: "vectorbt",
      label: "vectorbt worker",
      category: "backtesting",
      ready: workerReady("VECTORBT_WORKER_URL"),
      mode: workerReady("VECTORBT_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["VECTORBT_WORKER_URL"],
      detail: "Fast vectorized parameter sweeps and robustness grids outside serverless limits.",
      freeAlternative: "AutoResearch lab can sweep a small native candidate set.",
      docs: "https://vectorbt.dev/",
    },
    {
      key: "nautilus",
      label: "NautilusTrader worker",
      category: "backtesting",
      ready: workerReady("NAUTILUS_WORKER_URL"),
      mode: workerReady("NAUTILUS_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["NAUTILUS_WORKER_URL"],
      detail: "Production-grade multi-asset research/simulation/execution architecture, gated away from live orders.",
      freeAlternative: "Native paper-only research gates first; self-hosted LEAN/Backtrader/vectorbt when compute is available.",
      docs: "https://nautilustrader.io/docs/latest/",
    },
    {
      key: "fingpt",
      label: "FinGPT NLP worker",
      category: "ai-research",
      ready: workerReady("FINGPT_WORKER_URL"),
      mode: workerReady("FINGPT_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["FINGPT_WORKER_URL"],
      detail: "Research-only sentiment, filings summarization, contradiction checks, and catalyst explanations.",
      freeAlternative: "Structured rules plus public news headlines.",
      docs: "https://fingpt.io/",
    },
    {
      key: "finrl",
      label: "FinRL research worker",
      category: "ai-research",
      ready: workerReady("FINRL_WORKER_URL"),
      mode: workerReady("FINRL_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["FINRL_WORKER_URL"],
      detail: "Research-only reinforcement-learning experiments with overfit warnings and no live execution.",
      freeAlternative: "Native rule-based strategy validation.",
      docs: "https://finrl.readthedocs.io/en/latest/",
    },
    {
      key: "jesse",
      label: "Jesse crypto paper lane",
      category: "crypto",
      ready: workerReady("JESSE_WORKER_URL"),
      mode: workerReady("JESSE_WORKER_URL") ? "worker" : "missing",
      costProfile: "free-self-hosted",
      env: ["JESSE_WORKER_URL"],
      detail: "Separate crypto strategy and paper-trading lane so crypto assumptions do not leak into stock/futures research.",
      freeAlternative: "Binance public crypto quote adapter and Alpaca crypto endpoints.",
      docs: "https://jesse.trade/",
    },
    {
      key: "postgres",
      label: "Neon/Supabase Postgres",
      category: "database",
      ready: databaseConfigured(),
      mode: databaseConfigured() ? "credentialed" : "missing",
      costProfile: "free-self-hosted",
      env: ["DATABASE_URL"],
      detail: "Durable signals, notes, paper trades, outcome tracking, validation reports, and AutoResearch runs.",
      freeAlternative: "Local/self-hosted Postgres or a free-tier Postgres DATABASE_URL; AITable remains only an operations mirror.",
      docs: "https://neon.tech/docs",
    },
    {
      key: "supabase",
      label: "Supabase optional companion",
      category: "database",
      ready: hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
      mode: hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY") ? "credentialed" : "missing",
      costProfile: "optional-paid",
      env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      detail: "Optional companion database/storage/auth layer. The app's primary SQL target remains DATABASE_URL.",
      freeAlternative: "Self-hosted/local Postgres or free-tier Postgres through DATABASE_URL.",
      docs: "https://supabase.com/docs",
    },
  ];

  const criticalKeys = new Set(["alpaca", "sec-edgar", "public-market-fallbacks", "postgres"]);
  const configured = components.filter((component) => component.ready).length;
  const criticalConfigured = components.filter((component) => criticalKeys.has(component.key) && component.ready).length;
  const criticalTotal = criticalKeys.size;
  const workerCount = components.filter((component) => component.mode === "worker" && component.ready).length;
  const grade =
    criticalConfigured === criticalTotal && workerCount >= 3
      ? "production-path"
      : criticalConfigured >= 3
        ? "research-ready"
        : "partial";
  const freeReplacements: FreeReplacement[] = [
    {
      replaces: "Polygon.io / Twelve Data paid quote priority",
      freePath: "Default quote routing now tries composite public stocks, Binance public crypto, Yahoo public futures aliases, and Stooq delayed data before paid providers.",
      applied: true,
      limitation: "Research-only unless a licensed/entitled feed confirms the same trade-critical quote.",
    },
    {
      replaces: "Paid structured-news first path",
      freePath: "News auto mode now tries Yahoo Finance RSS first, while SEC EDGAR filings and scheduled event-risk rules feed the catalyst engine.",
      applied: true,
      limitation: "Free headlines are less structured and may miss paywalled or proprietary catalyst tags.",
    },
    {
      replaces: "Paid LLM-only analyst chat",
      freePath: "Analyst chat now tries LOCAL_LLM_BASE_URL with an OpenAI-compatible local/self-hosted model before paid OpenAI models, then deterministic cockpit fallback.",
      applied: true,
      limitation: "Local models depend on your hardware and cannot inspect sources outside the supplied dashboard context.",
    },
    {
      replaces: "Twilio/Resend-only alert posture",
      freePath: "Browser notifications and in-dashboard monitor alerts are the free default; webhook/SMS/email remain optional off-device channels.",
      applied: true,
      limitation: "Browser notifications require permission and work best while the app or installed PWA is active.",
    },
    {
      replaces: "CME/ICE commodity data as the only commodity context",
      freePath: "Commodity research uses public futures aliases, ETF proxies, and EIA/USDA event-risk references until licensed futures data is added.",
      applied: true,
      limitation: "No free path replaces licensed futures ticks, contract calendars, spread books, or execution-grade roll logic.",
    },
    {
      replaces: "OPRA-only options insight",
      freePath: "Options routes expose Alpaca indicative/contract-only context when permitted and label missing OPRA as partial.",
      applied: true,
      limitation: "There is no free OPRA-equivalent feed; do not infer unusual flow or IV history from incomplete snapshots.",
    },
    {
      replaces: "Paid hosted worker/database assumptions",
      freePath: "Native TradingAgents, AutoResearch, cost-aware backtests, local/self-hosted workers, and local/free-tier Postgres run without paid SaaS upgrades.",
      applied: true,
      limitation: "Durability and compute capacity depend on the machine or free-tier limits you choose.",
    },
  ];

  return {
    ok: true,
    grade,
    configured,
    total: components.length,
    criticalConfigured,
    criticalTotal,
    components,
    freeReplacements,
    workerCommands: [
      {
        name: "OpenBB worker",
        purpose: "Fundamentals, macro, options, and provider-key research.",
        command: "python workers/openbb_worker.py",
        urlEnv: "OPENBB_WORKER_URL",
      },
      {
        name: "OpenStock companion",
        purpose: "Self-hosted market-app companion for search, watchlists, company insights, market/news context, alerts, and UX comparison.",
        command: "node workers/openstock-worker.mjs",
        urlEnv: "OPENSTOCK_WORKER_URL",
      },
      {
        name: "StreetMerchant alert-pattern worker",
        purpose: "Self-hosted alert-loop, cooldown, notification fanout, and dashboard-status pressure testing. Not a financial quote feed.",
        command: "node workers/streetmerchant-alert-worker.mjs",
        urlEnv: "STREETMERCHANT_WORKER_URL",
      },
      {
        name: "Ghostfolio portfolio worker",
        purpose: "Self-hosted portfolio performance, holdings composition, static risk, transaction, and allocation analytics.",
        command: "node workers/ghostfolio-worker.mjs",
        urlEnv: "GHOSTFOLIO_WORKER_URL",
      },
      {
        name: "AKShare worker",
        purpose: "Free/self-hosted China/Asia market, macro, futures, bonds, options, funds, and reference-data research.",
        command: "python workers/akshare_worker.py",
        urlEnv: "AKSHARE_WORKER_URL",
      },
      {
        name: "LEAN worker",
        purpose: "Event-driven historical backtests and paper/live promotion trials.",
        command: "lean backtest \"TradingIntelStrategy\"",
        urlEnv: "LEAN_WORKER_URL",
      },
      {
        name: "StockSharp worker",
        purpose: "C#/.NET connector research, strategy tests, and broker-adapter simulations.",
        command: "dotnet run --project workers/StockSharpWorker",
        urlEnv: "STOCKSHARP_WORKER_URL",
      },
      {
        name: "RQAlpha worker",
        purpose: "Research-only event-driven backtests, simulation, risk checks, transaction costs, and analyser metrics.",
        command: "python workers/rqalpha_worker.py",
        urlEnv: "RQALPHA_WORKER_URL",
      },
      {
        name: "StockPredictionAI worker",
        purpose: "Research-only GAN/LSTM/CNN forecasts and feature-importance diagnostics.",
        command: "python workers/stockpredictionai_worker.py",
        urlEnv: "STOCKPREDICTIONAI_WORKER_URL",
      },
      {
        name: "LSTM Time Series worker",
        purpose: "Research-only Keras LSTM sequence forecasts, walk-forward holdouts, sequence-window checks, and dependency-drift warnings.",
        command: "python workers/lstm_time_series_worker.py",
        urlEnv: "LSTM_TIME_SERIES_WORKER_URL",
      },
      {
        name: "LLM Trading Lab worker",
        purpose: "Research-only LLM decision logs, portfolio experiments, stop-loss compliance, hard constraints, and benchmark comparisons.",
        command: "python workers/llm_trading_lab_worker.py",
        urlEnv: "LLM_TRADING_LAB_WORKER_URL",
      },
      {
        name: "Stock Prediction Models worker",
        purpose: "Research-only ML/DL forecasts, simulations, stacking, and RL-agent experiments.",
        command: "python workers/stock_prediction_models_worker.py",
        urlEnv: "STOCK_PREDICTION_MODELS_WORKER_URL",
      },
      {
        name: "Backtrader/vectorbt worker",
        purpose: "Independent strategy checks and parameter sweeps.",
        command: "python workers/quant_worker.py --engine vectorbt",
        urlEnv: "VECTORBT_WORKER_URL",
      },
      {
        name: "FinGPT/FinRL worker",
        purpose: "Research-only NLP and reinforcement-learning experiments.",
        command: "python workers/ai_research_worker.py",
        urlEnv: "FINGPT_WORKER_URL",
      },
      {
        name: "Jesse worker",
        purpose: "Crypto-only paper trading lane.",
        command: "jesse run",
        urlEnv: "JESSE_WORKER_URL",
      },
    ],
    missingExternalEntitlements: [
      "Execution-grade SIP or equivalent stock data remains optional for real-money equity execution; free/public quote paths are already applied for research.",
      "OPRA options entitlement has no true free replacement; current options output stays indicative or contract-only when OPRA is absent.",
      "CME/ICE/commodity futures licenses have no true free replacement for execution-grade futures; public aliases and ETF proxies stay research-only.",
      "Paid structured-news providers are optional; Yahoo RSS, SEC EDGAR, and event-risk rules are the free default.",
      "External research workers can be self-hosted for free, but always need some machine or hosting runtime.",
    ],
  };
}
