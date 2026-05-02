import { databaseConfigured } from "@/lib/db";
import { cleanSecret } from "@/lib/security";

export type ResearchStackComponent = {
  key: string;
  label: string;
  category: "market-data" | "news" | "filings" | "fundamentals" | "backtesting" | "ai-research" | "crypto" | "database";
  ready: boolean;
  mode: "credentialed" | "free-fallback" | "worker" | "native" | "missing";
  env: string[];
  detail: string;
  freeAlternative?: string;
  docs: string;
};

export type ResearchStackReadiness = {
  ok: boolean;
  grade: "production-path" | "research-ready" | "partial";
  configured: number;
  total: number;
  criticalConfigured: number;
  criticalTotal: number;
  components: ResearchStackComponent[];
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
      env: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "ALPACA_DATA_QUALITY"],
      detail: "Stocks bars/snapshots, account read-only sync, paper/live broker routes, options and crypto endpoints when entitled.",
      freeAlternative: "Public quote fallbacks remain active, but they are not execution-grade.",
      docs: "https://docs.alpaca.markets/",
    },
    {
      key: "polygon",
      label: "Polygon.io stock snapshots",
      category: "market-data",
      ready: hasEnv("POLYGON_API_KEY"),
      mode: hasEnv("POLYGON_API_KEY") ? "credentialed" : "missing",
      env: ["POLYGON_API_KEY"],
      detail: "Preferred stock snapshot adapter when the key and market-data entitlements exist.",
      freeAlternative: "Alpaca IEX, Nasdaq/CNBC public quote, Yahoo chart, Stooq delayed.",
      docs: "https://polygon.io/docs/rest/stocks/snapshots",
    },
    {
      key: "twelvedata",
      label: "Twelve Data quotes",
      category: "market-data",
      ready: hasEnv("TWELVE_DATA_API_KEY"),
      mode: hasEnv("TWELVE_DATA_API_KEY") ? "credentialed" : "missing",
      env: ["TWELVE_DATA_API_KEY"],
      detail: "Optional quote adapter for equities, ETFs, forex, and crypto depending on plan.",
      freeAlternative: "Alpaca/Yahoo/Binance/Stooq adapters.",
      docs: "https://twelvedata.com/docs",
    },
    {
      key: "public-market-fallbacks",
      label: "Public market fallbacks",
      category: "market-data",
      ready: true,
      mode: "free-fallback",
      env: [],
      detail: "Nasdaq/CNBC/Yahoo/Stooq/Binance fallbacks keep the dashboard alive when paid providers are absent or rate-limited.",
      docs: "https://stooq.com/",
    },
    {
      key: "benzinga",
      label: "Benzinga structured news",
      category: "news",
      ready: hasEnv("BENZINGA_API_KEY"),
      mode: hasEnv("BENZINGA_API_KEY") ? "credentialed" : "missing",
      env: ["BENZINGA_API_KEY"],
      detail: "Structured market news, catalysts, and ticker-tagged headlines when licensed.",
      freeAlternative: "Yahoo Finance RSS and SEC EDGAR filings.",
      docs: "https://docs.benzinga.com/",
    },
    {
      key: "finnhub",
      label: "Finnhub company news",
      category: "news",
      ready: hasEnv("FINNHUB_API_KEY"),
      mode: hasEnv("FINNHUB_API_KEY") ? "credentialed" : "missing",
      env: ["FINNHUB_API_KEY"],
      detail: "Company news endpoint for ticker-specific catalyst context.",
      freeAlternative: "Yahoo Finance RSS and SEC EDGAR filings.",
      docs: "https://finnhub.io/docs/api",
    },
    {
      key: "newsapi",
      label: "NewsAPI article search",
      category: "news",
      ready: hasEnv("NEWSAPI_API_KEY"),
      mode: hasEnv("NEWSAPI_API_KEY") ? "credentialed" : "missing",
      env: ["NEWSAPI_API_KEY"],
      detail: "Broad article search for additional source triangulation.",
      freeAlternative: "Yahoo Finance RSS.",
      docs: "https://newsapi.org/docs/endpoints/everything",
    },
    {
      key: "sec-edgar",
      label: "SEC EDGAR filings",
      category: "filings",
      ready: true,
      mode: "free-fallback",
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
      env: ["OPENBB_WORKER_URL"],
      detail: "External Python worker for deeper fundamentals, macro series, options context, and provider-key orchestration.",
      freeAlternative: "Native SEC company facts and Alpaca/Yahoo quotes.",
      docs: "https://docs.openbb.co/",
    },
    {
      key: "tradingagents",
      label: "TradingAgents native debate desk",
      category: "ai-research",
      ready: true,
      mode: "native",
      env: [],
      detail: "In-code analyst, bull/bear researcher, trader, risk, and portfolio-manager debate using current quotes, SEC/factor evidence, rule signals, and native backtests.",
      docs: "https://github.com/TauricResearch/TradingAgents",
    },
    {
      key: "lean",
      label: "QuantConnect LEAN worker",
      category: "backtesting",
      ready: workerReady("LEAN_WORKER_URL"),
      mode: workerReady("LEAN_WORKER_URL") ? "worker" : "missing",
      env: ["LEAN_WORKER_URL"],
      detail: "External event-driven backtest/paper/live engine path outside Vercel limits.",
      freeAlternative: "Native Alpaca daily-bar backtest.",
      docs: "https://www.quantconnect.com/docs/v2/lean-cli",
    },
    {
      key: "backtrader",
      label: "Backtrader worker",
      category: "backtesting",
      ready: workerReady("BACKTRADER_WORKER_URL"),
      mode: workerReady("BACKTRADER_WORKER_URL") ? "worker" : "missing",
      env: ["BACKTRADER_WORKER_URL"],
      detail: "Classic Python event-driven simulation lane for cross-checking simple/native results.",
      freeAlternative: "Native Alpaca daily-bar backtest.",
      docs: "https://www.backtrader.com/",
    },
    {
      key: "vectorbt",
      label: "vectorbt worker",
      category: "backtesting",
      ready: workerReady("VECTORBT_WORKER_URL"),
      mode: workerReady("VECTORBT_WORKER_URL") ? "worker" : "missing",
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
      env: ["NAUTILUS_WORKER_URL"],
      detail: "Production-grade multi-asset research/simulation/execution architecture, gated away from live orders.",
      freeAlternative: "LEAN and Backtrader worker lanes.",
      docs: "https://nautilustrader.io/docs/latest/",
    },
    {
      key: "fingpt",
      label: "FinGPT NLP worker",
      category: "ai-research",
      ready: workerReady("FINGPT_WORKER_URL"),
      mode: workerReady("FINGPT_WORKER_URL") ? "worker" : "missing",
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
      env: ["DATABASE_URL"],
      detail: "Durable signals, notes, paper trades, outcome tracking, validation reports, and AutoResearch runs.",
      freeAlternative: "AITable mirror for selected operational records.",
      docs: "https://neon.tech/docs",
    },
    {
      key: "supabase",
      label: "Supabase optional companion",
      category: "database",
      ready: hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
      mode: hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY") ? "credentialed" : "missing",
      env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      detail: "Optional companion database/storage/auth layer. The app's primary SQL target remains DATABASE_URL.",
      freeAlternative: "Neon Postgres via DATABASE_URL.",
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

  return {
    ok: true,
    grade,
    configured,
    total: components.length,
    criticalConfigured,
    criticalTotal,
    components,
    workerCommands: [
      {
        name: "OpenBB worker",
        purpose: "Fundamentals, macro, options, and provider-key research.",
        command: "python workers/openbb_worker.py",
        urlEnv: "OPENBB_WORKER_URL",
      },
      {
        name: "LEAN worker",
        purpose: "Event-driven historical backtests and paper/live promotion trials.",
        command: "lean backtest \"TradingIntelStrategy\"",
        urlEnv: "LEAN_WORKER_URL",
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
      "Consolidated SIP/paid stock data if you need execution-grade U.S. equity coverage.",
      "OPRA/options data entitlement for production options flow and volatility signals.",
      "CME/ICE/commodity futures market-data licenses for production futures signals.",
      "Paid structured-news terms if Benzinga/Finnhub/NewsAPI use exceeds free tiers.",
      "Separate external worker hosting for LEAN, OpenBB, Backtrader, vectorbt, NautilusTrader, FinGPT, FinRL, and Jesse.",
    ],
  };
}
