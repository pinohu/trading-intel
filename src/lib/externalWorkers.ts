import { cleanSecret } from "@/lib/security";

export type ExternalWorkerKey =
  | "openbb"
  | "openstock"
  | "ghostfolio"
  | "akshare"
  | "llmtradinglab"
  | "lean"
  | "stocksharp"
  | "stockpredictionai"
  | "stockpredictionmodels"
  | "backtrader"
  | "vectorbt"
  | "nautilus"
  | "fingpt"
  | "finrl"
  | "jesse";

export type ExternalWorkerJob = {
  jobType: "market-data" | "portfolio" | "fundamentals" | "backtest" | "parameter-sweep" | "forecast" | "agent-research" | "nlp" | "rl-research" | "crypto-paper";
  symbols: string[];
  strategy?: string;
  parameters?: Record<string, unknown>;
};

const externalWorkerJobTypes = ["market-data", "portfolio", "fundamentals", "backtest", "parameter-sweep", "forecast", "agent-research", "nlp", "rl-research", "crypto-paper"];

export const externalWorkerCatalog: Array<{
  key: ExternalWorkerKey;
  label: string;
  urlEnv: string;
  purpose: string;
  allowedJobs: ExternalWorkerJob["jobType"][];
}> = [
  {
    key: "openbb",
    label: "OpenBB",
    urlEnv: "OPENBB_WORKER_URL",
    purpose: "Fundamentals, macro, options, and provider-key research.",
    allowedJobs: ["fundamentals"],
  },
  {
    key: "openstock",
    label: "OpenStock",
    urlEnv: "OPENSTOCK_WORKER_URL",
    purpose: "AGPL-licensed companion market app lane for search, watchlists, company insights, market/news context, alerts, and UI/UX pattern comparison.",
    allowedJobs: ["market-data", "fundamentals", "nlp"],
  },
  {
    key: "ghostfolio",
    label: "Ghostfolio",
    urlEnv: "GHOSTFOLIO_WORKER_URL",
    purpose: "AGPL-licensed companion wealth-management lane for portfolio performance, holdings composition, static risk analysis, transactions, imports/exports, and multi-account context.",
    allowedJobs: ["portfolio", "market-data", "fundamentals"],
  },
  {
    key: "akshare",
    label: "AKShare",
    urlEnv: "AKSHARE_WORKER_URL",
    purpose: "Free/self-hosted Python financial data access for China/Asia markets, macro, futures, bonds, options, funds, and reference datasets.",
    allowedJobs: ["market-data", "fundamentals"],
  },
  {
    key: "llmtradinglab",
    label: "LLM Trading Lab",
    urlEnv: "LLM_TRADING_LAB_WORKER_URL",
    purpose: "Research-only LLM portfolio decision experiments with forward-only logs, hard constraints, stop-loss compliance, benchmark comparisons, and risk metrics.",
    allowedJobs: ["agent-research", "portfolio", "backtest", "forecast"],
  },
  {
    key: "lean",
    label: "QuantConnect LEAN",
    urlEnv: "LEAN_WORKER_URL",
    purpose: "Event-driven historical backtests and paper/live promotion trials.",
    allowedJobs: ["backtest"],
  },
  {
    key: "stocksharp",
    label: "StockSharp",
    urlEnv: "STOCKSHARP_WORKER_URL",
    purpose: "C#/.NET connector research, multi-market strategy tests, and broker-adapter simulations behind platform safety gates.",
    allowedJobs: ["backtest", "parameter-sweep", "crypto-paper"],
  },
  {
    key: "stockpredictionai",
    label: "StockPredictionAI",
    urlEnv: "STOCKPREDICTIONAI_WORKER_URL",
    purpose: "Research-only GAN/LSTM/CNN stock-movement forecasts with technical, sentiment, Fourier, ARIMA, XGBoost, and autoencoder-style features.",
    allowedJobs: ["forecast", "parameter-sweep", "nlp"],
  },
  {
    key: "stockpredictionmodels",
    label: "Stock Prediction Models",
    urlEnv: "STOCK_PREDICTION_MODELS_WORKER_URL",
    purpose: "Research-only ML/DL forecast, stacking, simulation, and reinforcement-learning agent experiments inspired by huseinzol05/Stock-Prediction-Models.",
    allowedJobs: ["forecast", "backtest", "parameter-sweep", "rl-research", "crypto-paper"],
  },
  {
    key: "backtrader",
    label: "Backtrader",
    urlEnv: "BACKTRADER_WORKER_URL",
    purpose: "Independent Python event-driven simulations.",
    allowedJobs: ["backtest"],
  },
  {
    key: "vectorbt",
    label: "vectorbt",
    urlEnv: "VECTORBT_WORKER_URL",
    purpose: "Fast vectorized parameter sweeps.",
    allowedJobs: ["parameter-sweep", "backtest"],
  },
  {
    key: "nautilus",
    label: "NautilusTrader",
    urlEnv: "NAUTILUS_WORKER_URL",
    purpose: "Production-grade multi-asset research and simulation.",
    allowedJobs: ["backtest"],
  },
  {
    key: "fingpt",
    label: "FinGPT",
    urlEnv: "FINGPT_WORKER_URL",
    purpose: "Research-only financial NLP and catalyst analysis.",
    allowedJobs: ["nlp"],
  },
  {
    key: "finrl",
    label: "FinRL",
    urlEnv: "FINRL_WORKER_URL",
    purpose: "Research-only reinforcement-learning experiments.",
    allowedJobs: ["rl-research"],
  },
  {
    key: "jesse",
    label: "Jesse",
    urlEnv: "JESSE_WORKER_URL",
    purpose: "Crypto-only paper-trading lane.",
    allowedJobs: ["crypto-paper", "backtest"],
  },
];

export function externalWorkerReadiness() {
  return externalWorkerCatalog.map((worker) => ({
    ...worker,
    configured: Boolean(cleanSecret(process.env[worker.urlEnv])),
  }));
}

export function validWorkerKey(value: unknown): value is ExternalWorkerKey {
  return typeof value === "string" && externalWorkerCatalog.some((worker) => worker.key === value);
}

export function validExternalWorkerJob(payload: unknown): payload is ExternalWorkerJob {
  if (!payload || typeof payload !== "object") return false;
  const item = payload as Partial<ExternalWorkerJob>;
  return (
    typeof item.jobType === "string" &&
    externalWorkerJobTypes.includes(item.jobType) &&
    Array.isArray(item.symbols) &&
    item.symbols.length > 0 &&
    item.symbols.length <= 50 &&
    item.symbols.every((symbol) => typeof symbol === "string" && /^[A-Z0-9.=/_-]{1,24}$/.test(symbol.trim().toUpperCase())) &&
    (!item.strategy || item.strategy.length <= 80)
  );
}

export async function runExternalWorkerJob(workerKey: ExternalWorkerKey, job: ExternalWorkerJob) {
  const worker = externalWorkerCatalog.find((item) => item.key === workerKey);
  if (!worker) throw new Error("Unknown worker.");
  if (!worker.allowedJobs.includes(job.jobType)) {
    throw new Error(`${worker.label} does not accept ${job.jobType} jobs.`);
  }
  const url = cleanSecret(process.env[worker.urlEnv]);
  if (!url) {
    throw new Error(`${worker.urlEnv} is not configured.`);
  }

  const timeoutMs = Number(process.env.WORKER_TIMEOUT_MS ?? "25000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 25000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WORKER_SHARED_SECRET ? { authorization: `Bearer ${cleanSecret(process.env.WORKER_SHARED_SECRET)}` } : {}),
      },
      body: JSON.stringify({
        ...job,
        symbols: job.symbols.map((symbol) => symbol.trim().toUpperCase()),
        requestedAt: new Date().toISOString(),
        source: "trading-intel-platform",
        safety: {
          researchOnly: true,
          noAutonomousExecution: true,
          brokerOrdersBlocked: true,
        },
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : `${worker.label} worker failed with ${response.status}`);
    }
    return { ok: true, worker: worker.label, data };
  } finally {
    clearTimeout(timer);
  }
}
