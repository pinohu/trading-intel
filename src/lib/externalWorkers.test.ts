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

  it("registers StockPredictionAI as a research-only forecast worker", () => {
    const worker = externalWorkerCatalog.find((item) => item.key === "stockpredictionai");

    expect(worker?.urlEnv).toBe("STOCKPREDICTIONAI_WORKER_URL");
    expect(worker?.allowedJobs).toContain("forecast");
    expect(worker?.allowedJobs).toContain("nlp");
    expect(validWorkerKey("stockpredictionai")).toBe(true);
    expect(validExternalWorkerJob({ jobType: "forecast", symbols: ["GS"], strategy: "gan-lstm-cnn" })).toBe(true);
  });

  it("accepts bounded worker jobs and rejects empty symbol jobs", () => {
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: ["SPY", "NVDA"], strategy: "daily-momentum-breakout" })).toBe(true);
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: [] })).toBe(false);
  });
});
