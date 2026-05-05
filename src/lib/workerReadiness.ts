export type WorkerReadiness = {
  ok: boolean;
  grade: "ready" | "partial" | "missing";
  components: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
  recommendedWorkers: Array<{
    name: string;
    purpose: string;
    cadence: string;
    command: string;
  }>;
};

export function buildWorkerReadiness(): WorkerReadiness {
  const components = [
    {
      key: "cron-secret",
      label: "Cron/API secret",
      ready: Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET ? "CRON_SECRET is configured." : "Set CRON_SECRET before external workers call monitor/outcome routes.",
    },
    {
      key: "database",
      label: "Worker database target",
      ready: Boolean(process.env.DATABASE_URL),
      detail: process.env.DATABASE_URL ? "DATABASE_URL is configured." : "Workers need DATABASE_URL-backed APIs for durable state.",
    },
    {
      key: "broker-stream",
      label: "Alpaca trade-updates stream",
      ready: process.env.ENABLE_ALPACA_TRADE_UPDATE_WORKER === "true",
      detail:
        process.env.ENABLE_ALPACA_TRADE_UPDATE_WORKER === "true"
          ? "Dedicated trade-update worker flag is enabled."
          : "Enable a persistent worker outside Vercel Functions for WebSocket trade_updates.",
    },
    {
      key: "market-loop",
      label: "Second-level market loop",
      ready: process.env.ENABLE_MARKET_WORKER === "true",
      detail:
        process.env.ENABLE_MARKET_WORKER === "true"
          ? "Dedicated market worker flag is enabled."
          : "Vercel cron is useful, but second-level scanning needs a persistent worker.",
    },
    {
      key: "autoresearch",
      label: "AutoResearch lab",
      ready: Boolean(process.env.CRON_SECRET && process.env.DATABASE_URL),
      detail:
        process.env.CRON_SECRET && process.env.DATABASE_URL
          ? "AutoResearch API can run bounded experiments and store run history."
          : "AutoResearch needs CRON_SECRET plus DATABASE_URL for unattended, durable research runs.",
    },
    {
      key: "external-quant-workers",
      label: "External quant workers",
      ready: Boolean(process.env.LEAN_WORKER_URL || process.env.STOCKSHARP_WORKER_URL || process.env.BACKTRADER_WORKER_URL || process.env.VECTORBT_WORKER_URL),
      detail:
        process.env.LEAN_WORKER_URL || process.env.STOCKSHARP_WORKER_URL || process.env.BACKTRADER_WORKER_URL || process.env.VECTORBT_WORKER_URL
          ? "At least one heavyweight quant worker URL is configured."
          : "Set LEAN_WORKER_URL, STOCKSHARP_WORKER_URL, BACKTRADER_WORKER_URL, or VECTORBT_WORKER_URL to run serious backtests outside Vercel.",
    },
    {
      key: "ai-research-workers",
      label: "AI research workers",
      ready: Boolean(process.env.FINGPT_WORKER_URL || process.env.FINRL_WORKER_URL),
      detail:
        process.env.FINGPT_WORKER_URL || process.env.FINRL_WORKER_URL
          ? "At least one optional AI research worker URL is configured."
          : "TradingAgents now runs in-code. Set FINGPT_WORKER_URL or FINRL_WORKER_URL only for optional external AI experiments.",
    },
  ];
  const readyCount = components.filter((item) => item.ready).length;
  return {
    ok: true,
    grade: readyCount === components.length ? "ready" : readyCount >= 2 ? "partial" : "missing",
    components,
    recommendedWorkers: [
      {
        name: "market-scan-worker",
        purpose: "Poll market data, run signal monitor, store snapshots, and send alerts.",
        cadence: "5s-60s depending on data license and rate limits",
        command: "node scripts/market-worker.mjs",
      },
      {
        name: "alpaca-trade-updates-worker",
        purpose: "Maintain Alpaca trade_updates WebSocket and reconcile order lifecycle events.",
        cadence: "persistent WebSocket",
        command: "node scripts/alpaca-trade-updates-worker.mjs",
      },
      {
        name: "proof-worker",
        purpose: "Evaluate due signal outcomes, refresh validation reports, and detect stale models.",
        cadence: "1m-15m",
        command: "node scripts/proof-worker.mjs",
      },
      {
        name: "autoresearch-lab-worker",
        purpose: "Run bounded AutoResearch-style strategy experiments and store champions.",
        cadence: "nightly or on demand",
        command: "node scripts/autoresearch-lab.mjs",
      },
      {
        name: "external-quant-worker",
        purpose: "Bridge LEAN, StockSharp, Backtrader, vectorbt, NautilusTrader, FinGPT, FinRL, and Jesse outside Vercel limits.",
        cadence: "on demand / scheduled research jobs",
        command: "python workers/quant_worker.py",
      },
      {
        name: "stocksharp-worker",
        purpose: "Run StockSharp C#/.NET connector research, strategy tests, and broker-adapter simulations behind the platform worker API.",
        cadence: "on demand / scheduled research jobs",
        command: "dotnet run --project workers/StockSharpWorker",
      },
    ],
  };
}
