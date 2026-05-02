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
  const [database, broker, proof, controls] = await Promise.all([
    databaseSchemaStatus(),
    allBrokerReadiness(),
    buildValidationReport(),
    getTradingControlState(),
  ]);
  const aitable = aitableReadiness();
  const workers = buildWorkerReadiness();
  const compliance = buildComplianceReadiness();
  const alerts = {
    webhook: Boolean(process.env.ALERT_WEBHOOK_URL),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && process.env.ALERT_TO_PHONE),
    email: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_TO_EMAIL),
    monitorSendsAlerts: process.env.SEND_MONITOR_ALERTS === "true",
  };
  const liveData = {
    alpacaConfigured: Boolean(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY) || Boolean(process.env.ALPACA_PAPER_API_KEY_ID && process.env.ALPACA_PAPER_API_SECRET_KEY),
    alpacaDataQuality: process.env.ALPACA_DATA_QUALITY ?? "iex",
    licensedSip: process.env.ALPACA_DATA_QUALITY === "sip" || Boolean(process.env.POLYGON_API_KEY),
    publicFallbacks: true,
  };
  const capabilities = [
    { key: "sql", label: "SQL persistence", ready: database.schemaReady, required: true },
    { key: "aitable", label: "AITable operations mirror", ready: aitable.mirrorReady, required: false },
    { key: "paperTrading", label: "Paper broker execution", ready: broker.paper.orderPlacementReady, required: true },
    { key: "liveTrading", label: "Live broker execution", ready: broker.live.orderPlacementReady, required: false },
    { key: "outcomes", label: "Signal outcome tracker", ready: database.schemaReady, required: true },
    { key: "backtests", label: "Backtest evidence storage", ready: database.schemaReady, required: true },
    { key: "risk", label: "Portfolio risk snapshots", ready: database.schemaReady && broker.paper.credentialsConfigured, required: true },
    { key: "alerts", label: "Off-device alerts", ready: alerts.webhook || alerts.sms || alerts.email, required: false },
    { key: "auth", label: "Private access gate", ready: productionSecretsConfigured(), required: true },
    { key: "licensedData", label: "Licensed real-time market data", ready: liveData.licensedSip, required: false },
    { key: "controlPlane", label: "Kill switch and OMS controls", ready: !controls.killSwitch, required: true },
    { key: "validation", label: "Proof validation gates", ready: proof.grade !== "red", required: true },
    { key: "workers", label: "Persistent worker path", ready: workers.grade !== "missing", required: false },
    { key: "compliance", label: "Research/compliance boundary", ready: compliance.grade !== "blocked", required: true },
  ];

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    productionReadyCore: capabilities.filter((item) => item.required).every((item) => item.ready),
    capabilities,
    database,
    aitable,
    broker,
    alerts,
    liveData,
    controls,
    proof,
    workers,
    compliance,
    providers: providerCatalog,
    remainingLimits: [
      liveData.licensedSip ? "" : "Stocks are using Alpaca IEX/public feeds unless SIP/Polygon-style licensed data is added.",
      broker.live.orderPlacementReady ? "" : "Live execution remains locked until live Alpaca keys, live flag, acknowledgement, and audit DB are ready.",
      alerts.webhook || alerts.sms || alerts.email ? "" : "Off-device alerts need webhook, Twilio, or Resend credentials.",
      "Commodity futures still require a licensed futures broker/feed. The app can execute commodity ETFs through Alpaca, not CME futures contracts.",
    ].filter(Boolean),
  });
}
