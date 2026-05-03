import { NextResponse } from "next/server";
import { brokerReadiness } from "@/lib/broker";
import { databaseSchemaStatus } from "@/lib/db";

export async function GET() {
  const database = await databaseSchemaStatus();
  const broker = await brokerReadiness();
  const licensedRealTimeData = Boolean(process.env.POLYGON_API_KEY || process.env.TWELVE_DATA_API_KEY || process.env.ALPACA_DATA_QUALITY === "sip");
  const optionalOffDeviceAlerts = Boolean(process.env.ALERT_WEBHOOK_URL || (process.env.TWILIO_ACCOUNT_SID && process.env.ALERT_TO_PHONE) || (process.env.RESEND_API_KEY && process.env.ALERT_TO_EMAIL));
  const checks = [
    { key: "auth", label: "Private access gate", ready: Boolean(process.env.TRADING_ACCESS_CODE && process.env.TRADING_ACCESS_TOKEN), required: true },
    { key: "cron", label: "Vercel cron monitor", ready: true, required: true },
    { key: "cronSecret", label: "Cron secret", ready: Boolean(process.env.CRON_SECRET), required: true },
    { key: "realTimeData", label: "Optional licensed real-time data", ready: licensedRealTimeData, required: false },
    { key: "publicRealtime", label: "Public timestamped real-time quote paths", ready: true, required: false },
    { key: "freeFeeds", label: "Free-first public feed fallbacks", ready: true, required: true },
    { key: "alpaca", label: "Alpaca/IEX adapter", ready: Boolean(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY), required: false },
    { key: "browserAlerts", label: "Free browser notification path", ready: true, required: true },
    { key: "alerts", label: "Optional off-device alerts", ready: optionalOffDeviceAlerts, required: false },
    { key: "database", label: "Persistent database", ready: database.reachable, required: true },
    { key: "schema", label: "Persistence schema applied", ready: database.schemaReady, required: true },
    { key: "outcomes", label: "Signal outcome tracker", ready: database.schemaReady, required: true },
    { key: "backtests", label: "Historical backtest storage", ready: database.schemaReady, required: true },
    { key: "riskSnapshots", label: "Portfolio risk snapshots", ready: database.schemaReady, required: true },
    { key: "orderLifecycle", label: "Broker order lifecycle audit", ready: database.schemaReady, required: true },
    { key: "brokerReadOnly", label: "Broker read-only integration", ready: Boolean(process.env.BROKER_READ_ONLY_TOKEN), required: false },
    { key: "brokerTrading", label: "Broker execution", ready: broker.orderPlacementReady, required: false },
    { key: "liveBrokerTrading", label: "Live broker execution", ready: broker.mode === "live" && broker.orderPlacementReady, required: false },
  ];
  return NextResponse.json({
    mode: "research-and-paper",
    readyForRealMoneyExecution: broker.mode === "live" && broker.orderPlacementReady && licensedRealTimeData,
    checks,
    missingRequired: checks.filter((check) => check.required && !check.ready).map((check) => check.key),
    freeAlternativesApplied: [
      "Free-first quote routing is the default.",
      "Free browser notifications are the baseline alert path.",
      "Paid market data and off-device SMS/email are optional for research mode.",
    ],
    paidStillNeededFor: [
      "Execution-grade consolidated equity decisions.",
      "Execution-grade OPRA options flow.",
      "Execution-grade CME/ICE futures signals.",
    ],
    broker: {
      mode: broker.mode,
      orderPlacementReady: broker.orderPlacementReady,
      missing: broker.missing,
      restrictions: broker.restrictions,
    },
  });
}
