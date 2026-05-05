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

  it("accepts bounded worker jobs and rejects empty symbol jobs", () => {
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: ["SPY", "NVDA"], strategy: "daily-momentum-breakout" })).toBe(true);
    expect(validExternalWorkerJob({ jobType: "backtest", symbols: [] })).toBe(false);
  });
});
