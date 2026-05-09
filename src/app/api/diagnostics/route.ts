import { NextResponse } from "next/server";
import { aitableReadiness } from "@/lib/aitable";
import { allBrokerReadiness } from "@/lib/broker";
import { buildComplianceReadiness } from "@/lib/compliance";
import { databaseSchemaStatus } from "@/lib/db";
import { getTradingControlState } from "@/lib/executionControl";
import { providerCatalog } from "@/lib/providers";
import { productionSecretsConfigured } from "@/lib/security";
import { buildValidationReport } from "@/lib/validationEngine";
import { buildWorkerReadiness } from "@/lib/workerReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const [database, broker, controls, proof] = await Promise.all([
    databaseSchemaStatus(),
    allBrokerReadiness(),
    getTradingControlState(),
    buildValidationReport(),
  ]);
  const aitable = aitableReadiness();
  const workers = buildWorkerReadiness();
  const compliance = buildComplianceReadiness();
  const licensedData = process.env.ALPACA_DATA_QUALITY === "sip" || Boolean(process.env.POLYGON_API_KEY || process.env.TWELVE_DATA_API_KEY);
  const streamWorkerEnabled = process.env.ENABLE_ALPACA_TRADE_UPDATE_WORKER === "true";

  const checks = [
    {
      key: "auth",
      label: "Private access",
      ready: productionSecretsConfigured(),
      severity: "critical",
      action: "Set ACCESS_CODE and TRADING_ACCESS_TOKEN.",
    },
    {
      key: "database",
      label: "Persistent storage",
      ready: database.schemaReady,
      severity: "critical",
      action: "Apply database/schema.sql and configure the database URL.",
    },
    {
      key: "paperBroker",
      label: "Paper broker",
      ready: broker.paper.orderPlacementReady,
      severity: "high",
      action: "Set ALPACA_PAPER_API_KEY_ID and ALPACA_PAPER_API_SECRET_KEY.",
    },
    {
      key: "liveBroker",
      label: "Live broker",
      ready: broker.live.orderPlacementReady,
      severity: "high",
      action: "Set live Alpaca keys, live acknowledgement, audit DB, and live enablement.",
    },
    {
      key: "licensedMarketData",
      label: "Licensed market data",
      ready: licensedData,
      severity: "medium",
      action: "Use ALPACA_DATA_QUALITY=sip or a licensed provider for execution-grade U.S. equities.",
    },
    {
      key: "streamWorker",
      label: "Durable stream worker",
      ready: streamWorkerEnabled,
      severity: "medium",
      action: "Run an always-on worker for Alpaca websocket trade_updates and market-data streams.",
    },
    {
      key: "controls",
      label: "Kill switch",
      ready: !controls.killSwitch,
      severity: "critical",
      action: "Disable the kill switch only after readiness checks pass.",
    },
    {
      key: "validation",
      label: "Validation proof",
      ready: proof.grade !== "red",
      severity: "high",
      action: "Resolve failed validation gates before live execution.",
    },
    {
      key: "aitable",
      label: "AITable mirror",
      ready: aitable.mirrorReady,
      severity: "low",
      action: "Configure AITable only if you want external operations mirroring.",
    },
  ];

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: broker.live.orderPlacementReady ? "live-capable" : broker.paper.orderPlacementReady ? "paper-capable" : "research-only",
    overallReady: checks.filter((check) => check.severity === "critical").every((check) => check.ready),
    checks,
    broker,
    database,
    controls,
    proof: {
      grade: proof.grade,
      summary: proof.summary,
    },
    workers,
    compliance,
    providers: providerCatalog.map((provider) => ({
      name: provider.name,
      configured: provider.configured,
      quality: provider.quality,
      cost: provider.cost,
    })),
    streaming: {
      currentMode: streamWorkerEnabled ? "worker-ready" : "polling",
      browserRefreshSeconds: 15,
      marketDataWebsocket: "wss://stream.data.alpaca.markets/v2/iex",
      tradeUpdatesWebsocket: broker.live.orderPlacementReady ? "wss://api.alpaca.markets/stream" : "wss://paper-api.alpaca.markets/stream",
      limitation: streamWorkerEnabled
        ? "Worker flag is enabled; verify the external worker is deployed and persisting events."
        : "The Next.js app cannot keep a durable websocket open by itself on serverless hosting.",
    },
  });
}
