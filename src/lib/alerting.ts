import type { TradeSignal } from "@/lib/signalEngine";

export type AlertResult = {
  channel: string;
  configured: boolean;
  ok: boolean;
  detail: string;
};

function signalText(signal: TradeSignal) {
  return `${signal.action}: ${signal.symbol} ${signal.quality}/${signal.confidence} ${signal.setup}. Price ${signal.price}, stop ${signal.invalidation}, target ${signal.target}, R/R ${signal.rewardRisk}. ${signal.reason}`;
}

export async function sendSignalAlerts(signals: TradeSignal[]): Promise<AlertResult[]> {
  const actionable = signals.filter((signal) => signal.action !== "Hold/No Trade" && signal.quality !== "Avoid");
  const message =
    actionable.length === 0
      ? "Trading Intelligence monitor ran: no actionable buy/sell-watch signals."
      : actionable.slice(0, 5).map(signalText).join("\n\n");

  const results: AlertResult[] = [];

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signals: actionable, source: "trading-intel-platform" }),
      });
      results.push({ channel: "webhook", configured: true, ok: response.ok, detail: `HTTP ${response.status}` });
    } catch (error) {
      results.push({ channel: "webhook", configured: true, ok: false, detail: error instanceof Error ? error.message : "Webhook failed" });
    }
  } else {
    results.push({ channel: "webhook", configured: false, ok: false, detail: "ALERT_WEBHOOK_URL not configured" });
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  const twilioTo = process.env.ALERT_TO_PHONE;
  if (twilioSid && twilioToken && twilioFrom && twilioTo) {
    try {
      const body = new URLSearchParams({ From: twilioFrom, To: twilioTo, Body: message.slice(0, 1500) });
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });
      results.push({ channel: "sms", configured: true, ok: response.ok, detail: `HTTP ${response.status}` });
    } catch (error) {
      results.push({ channel: "sms", configured: true, ok: false, detail: error instanceof Error ? error.message : "SMS failed" });
    }
  } else {
    results.push({ channel: "sms", configured: false, ok: false, detail: "Twilio phone env vars not configured" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_TO_EMAIL;
  const emailFrom = process.env.ALERT_FROM_EMAIL ?? "Trading Intelligence <alerts@resend.dev>";
  if (resendKey && alertEmail) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: alertEmail,
          subject: actionable.length ? `Trading signals: ${actionable[0].symbol}` : "Trading monitor: no signal",
          text: message,
        }),
      });
      results.push({ channel: "email", configured: true, ok: response.ok, detail: `HTTP ${response.status}` });
    } catch (error) {
      results.push({ channel: "email", configured: true, ok: false, detail: error instanceof Error ? error.message : "Email failed" });
    }
  } else {
    results.push({ channel: "email", configured: false, ok: false, detail: "RESEND_API_KEY/ALERT_TO_EMAIL not configured" });
  }

  return results;
}
