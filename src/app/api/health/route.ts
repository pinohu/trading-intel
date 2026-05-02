import { NextResponse } from "next/server";
import { aitableReadiness } from "@/lib/aitable";
import { brokerConfig } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { quoteCacheStats } from "@/lib/providerCache";

export const dynamic = "force-dynamic";

export function GET() {
  const paperBroker = brokerConfig("paper");
  const liveBroker = brokerConfig("live");
  const aitable = aitableReadiness();
  return NextResponse.json({
    ok: true,
    mode: "research-and-paper",
    liveTradingEnabled: liveBroker.executionEnabled && liveBroker.liveTradingEnabled && liveBroker.liveAckConfigured && liveBroker.credentialsConfigured,
    authConfigured: Boolean(process.env.TRADING_ACCESS_CODE && process.env.TRADING_ACCESS_TOKEN),
    providers: {
      delayedQuotes: "stooq",
      news: "yahoo-finance-rss",
      polygon: Boolean(process.env.POLYGON_API_KEY),
      twelveData: Boolean(process.env.TWELVE_DATA_API_KEY),
      benzinga: Boolean(process.env.BENZINGA_API_KEY),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      database: databaseConfigured(),
      aitableMirror: aitable.mirrorReady,
      aitableApi: aitable.apiKeyConfigured,
      quoteCache: quoteCacheStats(),
      cronSecret: Boolean(process.env.CRON_SECRET),
      webhookAlerts: Boolean(process.env.ALERT_WEBHOOK_URL),
      smsAlerts: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.ALERT_TO_PHONE),
      emailAlerts: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_TO_EMAIL),
      brokerReadOnly: Boolean(process.env.BROKER_READ_ONLY_TOKEN),
      alpacaPaper: paperBroker.credentialsConfigured,
      alpacaLive: liveBroker.credentialsConfigured,
      alpacaDataQuality: process.env.ALPACA_DATA_QUALITY ?? "not-configured",
      brokerExecution: paperBroker.executionEnabled || liveBroker.executionEnabled,
      brokerMode: process.env.BROKER_EXECUTION_MODE ?? "paper",
      paperBrokerArmed: paperBroker.executionEnabled && paperBroker.credentialsConfigured,
      liveBrokerArmed: liveBroker.executionEnabled && liveBroker.liveTradingEnabled && liveBroker.liveAckConfigured && liveBroker.credentialsConfigured,
    },
    guardrails: [
      "Broker execution routes are user-session only and block cron/bearer automation.",
      "Live broker execution requires Alpaca live credentials, explicit env gates, per-order acknowledgement, and database audit storage.",
      "AITable is enabled as an operations mirror/fallback, not as a replacement for the SQL audit database required for live execution.",
      "Research notes are local-browser until a database is configured.",
      "Use paid/licensed feeds before relying on intraday decisions.",
    ],
  });
}
