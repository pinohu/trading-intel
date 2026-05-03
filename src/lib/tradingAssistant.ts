export type TradingAssistantRole = "user" | "assistant";

export type TradingAssistantMessage = {
  role: TradingAssistantRole;
  content: string;
};

export type TradingAssistantDashboardContext = {
  asOf: string;
  selectedSymbol?: string;
  provider?: string;
  brokerMode?: string;
  feedQuality?: string;
  secondsAgo?: number | null;
  topBuyDecision?: Record<string, unknown> | null;
  topSellDecision?: Record<string, unknown> | null;
  tradeTicket?: Record<string, unknown> | null;
  buyNow?: Array<Record<string, unknown>>;
  blockedBuyNow?: Array<Record<string, unknown>>;
  buyLeads?: Array<Record<string, unknown>>;
  risk?: Record<string, unknown> | null;
  broker?: Record<string, unknown> | null;
  modelPerformance?: Record<string, unknown> | null;
  orchestration?: Record<string, unknown> | null;
  referenceReports?: Record<string, unknown> | null;
  news?: Array<Record<string, unknown>>;
};

export const tradingAssistantModels = {
  local: "gpt-oss:20b",
  primary: "gpt-5.2",
  fallback: "gpt-5.1",
  fast: "gpt-5-mini",
} as const;

export const tradingAssistantInstructions = [
  "You are the Trading Intelligence analyst chat inside a private research and execution-readiness cockpit.",
  "Answer from the supplied dashboard context first. If something is not in context, say so and name the data that would be needed.",
  "Do not fabricate quotes, news, filings, broker state, order status, or model results.",
  "Do not provide personalized financial advice or guarantees. Frame trade discussion as research, planning, and risk review.",
  "For trade questions, always mention the relevant trigger, stop/invalidation, target, risk/reward, position sizing, and what would block the trade when those fields are available.",
  "Never claim a live order was placed. Live execution always requires the app's broker rail and manual acknowledgement.",
  "Be concise, direct, and practical. Use short sections only when they make the answer easier to scan.",
].join("\n");

export function normalizeAssistantMessages(value: unknown, limit = 12): TradingAssistantMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const message = item as Partial<TradingAssistantMessage>;
      const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : null;
      const content = typeof message.content === "string" ? message.content.trim() : "";
      if (!role || !content) return null;
      return {
        role,
        content: content.slice(0, 4000),
      };
    })
    .filter((item): item is TradingAssistantMessage => Boolean(item))
    .slice(-limit);
}

export function sanitizeAssistantContext(value: unknown): TradingAssistantDashboardContext {
  const context = value && typeof value === "object" ? (value as Partial<TradingAssistantDashboardContext>) : {};
  return {
    asOf: typeof context.asOf === "string" ? context.asOf : new Date().toISOString(),
    selectedSymbol: stringValue(context.selectedSymbol),
    provider: stringValue(context.provider),
    brokerMode: stringValue(context.brokerMode),
    feedQuality: stringValue(context.feedQuality),
    secondsAgo: numberOrNull(context.secondsAgo),
    topBuyDecision: objectOrNull(context.topBuyDecision),
    topSellDecision: objectOrNull(context.topSellDecision),
    tradeTicket: objectOrNull(context.tradeTicket),
    buyNow: arrayOfObjects(context.buyNow, 5),
    blockedBuyNow: arrayOfObjects(context.blockedBuyNow, 5),
    buyLeads: arrayOfObjects(context.buyLeads, 5),
    risk: objectOrNull(context.risk),
    broker: objectOrNull(context.broker),
    modelPerformance: objectOrNull(context.modelPerformance),
    orchestration: objectOrNull(context.orchestration),
    referenceReports: objectOrNull(context.referenceReports),
    news: arrayOfObjects(context.news, 6),
  };
}

export function buildTradingAssistantPrompt({
  messages,
  context,
}: {
  messages: TradingAssistantMessage[];
  context: TradingAssistantDashboardContext;
}) {
  const transcript = messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n\n");

  return [
    "Dashboard context JSON:",
    safeJson(context),
    "",
    "Conversation so far:",
    transcript,
    "",
    "Answer the latest user message using the dashboard context.",
  ].join("\n");
}

export function localTradingAssistantAnswer({
  question,
  context,
}: {
  question: string;
  context: TradingAssistantDashboardContext;
}) {
  const cleanQuestion = question.trim();
  const ticket = context.tradeTicket;
  const buyDecision = context.topBuyDecision;
  const riskFlags = Array.isArray(context.risk?.riskFlags) ? context.risk.riskFlags : [];
  const buyNow = context.buyNow ?? [];
  const blockers = context.blockedBuyNow ?? [];
  const referenceTotal = typeof context.referenceReports?.total === "number" ? context.referenceReports.total : undefined;
  const selected = context.selectedSymbol ?? stringValue(ticket?.symbol) ?? stringValue(buyDecision?.symbol) ?? "the selected symbol";

  if (!cleanQuestion) {
    return "Ask a specific trading, risk, research, broker, or model-evidence question and I will answer from the current cockpit context.";
  }

  const tradeLines = [
    `${selected}: ${stringValue(buyDecision?.action) ?? stringValue(ticket?.status) ?? "current setup under review"}.`,
    ticket
      ? `Ticket: trigger ${money(ticket.trigger)}, stop ${money(ticket.stop)}, target ${money(ticket.target)}, R/R ${stringValue(ticket.riskRewardRatio) ?? stringValue(ticket.rewardRisk) ?? "N/A"}R.`
      : "No complete trade ticket is present in the context.",
    ticket
      ? `Sizing: ${stringValue(ticket.positionSize) ?? "position size unavailable"}. Suggested: ${stringValue(ticket.suggestedPositionSize) ?? "not available"}.`
      : "Run or refresh the ticket engine before sizing a trade.",
    ticket ? `Entry signal needed: ${stringValue(ticket.entrySignalNeeded) ?? "not specified"}.` : "",
  ].filter(Boolean);

  const riskLine = riskFlags.length
    ? `Portfolio risk flags: ${riskFlags.slice(0, 4).join("; ")}.`
    : "No portfolio risk flags were included in the current context.";

  const buyNowLine = buyNow.length
    ? `Active buy-now candidates: ${buyNow.map((item) => stringValue(item.symbol)).filter(Boolean).join(", ")}.`
    : blockers.length
      ? `No clean buy-now promotion; blocked candidates include ${blockers.map((item) => stringValue(item.symbol)).filter(Boolean).join(", ")}.`
      : "No buy-now list was included in the current context.";

  const referencesLine = referenceTotal
    ? `${referenceTotal} reference-report rules are applied, including the minimum reward/risk promotion gate.`
    : "Reference-report rule coverage was not included in the local context.";

  const lower = cleanQuestion.toLowerCase();
  if (lower.includes("risk") || lower.includes("block") || lower.includes("avoid")) {
    return [`Risk read:`, riskLine, buyNowLine, ticket ? `Do not trade if: ${arrayText(ticket.doNotTradeIf)}.` : "", referencesLine].filter(Boolean).join("\n");
  }

  if (lower.includes("position") || lower.includes("size") || lower.includes("entry") || lower.includes("trigger")) {
    return [`Execution brief:`, ...tradeLines, riskLine].join("\n");
  }

  if (lower.includes("reference") || lower.includes("report") || lower.includes("why")) {
    return [
      "Reference-report impact:",
      referencesLine,
      "The chat can explain evidence that is not prominent on the dashboard, but the local fallback cannot inspect new external sources.",
      ticket ? `For this ticket, the applied gate is ${stringValue(ticket.riskRewardRatio) ?? stringValue(ticket.rewardRisk) ?? "N/A"}R with ${stringValue(ticket.suggestedPositionSize) ?? "no suggested size"}.` : "",
    ].filter(Boolean).join("\n");
  }

  return [`Current cockpit read:`, ...tradeLines, buyNowLine, riskLine, referencesLine].join("\n");
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 14000);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function objectOrNull(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function arrayOfObjects(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).slice(0, limit);
}

function money(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function arrayText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "no explicit blockers listed";
  return value.map((item) => String(item)).filter(Boolean).slice(0, 4).join("; ");
}
