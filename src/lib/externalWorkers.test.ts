import { describe, expect, it } from "vitest";
import { externalWorkerCatalog, validExternalWorkerJob, validWorkerKey } from "@/lib/externalWorkers";

describe("external worker catalog", () => {
  it("registers OpenStock as a bounded companion market worker", () => {
    const openstock = externalWorkerCatalog.find((worker) => worker.key === "openstock");

    expect(openstock?.urlEnv).toBe("OPENSTOCK_WORKER_URL");
    expect(openstock?.allowedJobs).toContain("market-data");
    expect(openstock?.allowedJobs).toContain("fundamentals");
    expect(openstock?.allowedJobs).toContain("nlp");
    expect(validWorkerKey("openstock")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "market-data", symbols: ["AAPL"], strategy: "companion-watchlist-context" })).toBe(true);
  });

  it("registers StreetMerchant as a bounded alert monitor worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "streetmerchant");

    expect(worker?.urlEnv).toBe("STREETMERCHANT_WORKER_URL");
    expect(worker?.allowedJobs).toEqual(["alert-monitor"]);
    expect(validWorkerKey("streetmerchant")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "alert-monitor", symbols: ["NVDA", "AMD"], strategy: "trigger-watch-alert-fanout" })).toBe(true);
  });

  it("registers Ghostfolio as a bounded portfolio analytics worker", () => {
    const ghostfolio = externalWorkerCatalog.find((worker) => worker.key === "ghostfolio");

    expect(ghostfolio?.urlEnv).toBe("GHOSTFOLIO_WORKER_URL");
    expect(ghostfolio?.allowedJobs).toContain("portfolio");
    expect(ghostfolio?.allowedJobs).toContain("market-data");
    expect(validWorkerKey("ghostfolio")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "portfolio", symbols: ["SPY", "NVDA"], strategy: "exposure-check" })).toBe(true);
  });

  it("registers AKShare as a bounded research data worker", () => {
    const akshare = externalWorkerCatalog.find((worker) => worker.key === "akshare");

    expect(akshare?.urlEnv).toBe("AKSHARE_WORKER_URL");
    expect(akshare?.allowedJobs).toContain("market-data");
    expect(akshare?.allowedJobs).toContain("fundamentals");
    expect(validWorkerKey("akshare")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "market-data", symbols: ["000001.SZ"], strategy: "daily-bars" })).toBe(true);
  });

  it("registers StockSharp as a bounded external worker", () => {
    const stocksharp = externalWorkerCatalog.find((worker) => worker.key === "stocksharp");

    expect(stocksharp?.urlEnv).toBe("STOCKSHARP_WORKER_URL");
    expect(stocksharp?.allowedJobs).toContain("backtest");
    expect(stocksharp?.allowedJobs).toContain("parameter-sweep");
    expect(validWorkerKey("stocksharp")).toBe(true);
  });

  it("registers RQAlpha as a bounded event-driven backtest worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "rqalpha");

    expect(worker?.urlEnv).toBe("RQALPHA_WORKER_URL");
    expect(worker?.allowedJobs).toContain("backtest");
    expect(worker?.allowedJobs).toContain("parameter-sweep");
    expect(worker?.allowedJobs).toContain("portfolio");
    expect(validWorkerKey("rqalpha")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: ["000001.XSHE"], strategy: "rqalpha-mod-risk-simulation" })).toBe(true);
  });

  it("registers LSTM Time Series as a research-only forecast worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "lstmtimeseries");

    expect(worker?.urlEnv).toBe("LSTM_TIME_SERIES_WORKER_URL");
    expect(worker?.allowedJobs).toContain("forecast");
    expect(worker?.allowedJobs).toContain("parameter-sweep");
    expect(validWorkerKey("lstmtimeseries")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "forecast", symbols: ["AAPL"], strategy: "lstm-sequence-holdout" })).toBe(true);
  });

  it("registers StockPredictionAI as a research-only forecast worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "stockpredictionai");

    expect(worker?.urlEnv).toBe("STOCKPREDICTIONAI_WORKER_URL");
    expect(worker?.allowedJobs).toContain("forecast");
    expect(worker?.allowedJobs).toContain("nlp");
    expect(validWorkerKey("stockpredictionai")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "forecast", symbols: ["GS"], strategy: "gan-lstm-cnn" })).toBe(true);
  });

  it("registers LLM Trading Lab as a bounded agent research worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "llmtradinglab");

    expect(worker?.urlEnv).toBe("LLM_TRADING_LAB_WORKER_URL");
    expect(worker?.allowedJobs).toContain("agent-research");
    expect(worker?.allowedJobs).toContain("portfolio");
    expect(validWorkerKey("llmtradinglab")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "agent-research", symbols: ["SPY"], strategy: "forward-only-daily-agent-log" })).toBe(true);
  });

  it("registers Stock Prediction Models as a research-only model-zoo worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "stockpredictionmodels");

    expect(worker?.urlEnv).toBe("STOCK_PREDICTION_MODELS_WORKER_URL");
    expect(worker?.allowedJobs).toContain("forecast");
    expect(worker?.allowedJobs).toContain("rl-research");
    expect(validWorkerKey("stockpredictionmodels")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "rl-research", symbols: ["SPY"], strategy: "agent-comparison" })).toBe(true);
  });

  it("accepts bounded worker jobs and rejects empty symbol jobs", () => {
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: ["SPY", "NVDA"], strategy: "daily-momentum-breakout" })).toBe(true);
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: [] })).toBe(false);
  });
});
