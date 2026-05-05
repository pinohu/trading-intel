import { describe, expect, it } from "vitest";
import { externalWorkerCatalog, validExternalWorkerJob, validWorkerKey } from "@/lib/externalWorkers";

describe("external worker catalog", () => {
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
