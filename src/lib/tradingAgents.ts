export type TradingAgentsDepth = "fast" | "standard" | "deep";

export type TradingAgentsDecision = {
  symbol: string;
  rating: string;
  action: string;
  summary: string;
  thesis: string;
  risks: string[];
  portfolioDecision: string;
};

const validSymbolPattern = /^[A-Z0-9.=/_-]{1,24}$/;

export function parseTradingAgentsSymbols(value: unknown, fallback: string[] = []) {
  const raw =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value.map((item) => String(item))
        : fallback;

  return Array.from(
    new Set(
      raw
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => validSymbolPattern.test(symbol)),
    ),
  ).slice(0, 8);
}

export function validTradingAgentsDepth(value: unknown): value is TradingAgentsDepth {
  return value === "fast" || value === "standard" || value === "deep";
}

export function cleanTradingAgentsDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date().toISOString().slice(0, 10);
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? value : new Date().toISOString().slice(0, 10);
}

export function normalizeTradingAgentsDecisions(data: unknown, symbols: string[]): TradingAgentsDecision[] {
  const records = findDecisionRecords(data);
  return symbols.map((symbol, index) => {
    const record = records.find((item) => readString(item, ["symbol", "ticker"])?.toUpperCase() === symbol) ?? records[index] ?? data;
    const rating = readString(record, ["rating", "recommendation", "decision", "signal"]) ?? "Research Review";
    const action = readString(record, ["action", "trade_action", "tradeAction", "order", "position"]) ?? normalizeActionFromRating(rating);
    const thesis =
      readString(record, ["thesis", "rationale", "reasoning", "analysis", "summary", "report"]) ??
      stringifyForNote(record);
    const portfolioDecision =
      readString(record, ["portfolio_decision", "portfolioDecision", "portfolio_manager", "portfolioManager", "final_decision"]) ??
      rating;
    const risks = readStringArray(record, ["risks", "risk_controls", "riskControls", "warnings", "concerns"]);

    return {
      symbol,
      rating: clampText(rating, 80),
      action: clampText(action, 80),
      summary: clampText(thesis, 500),
      thesis: clampText(thesis, 1600),
      risks: risks.length ? risks.slice(0, 8).map((risk) => clampText(risk, 240)) : ["Treat as research-only until backtested and paper-validated."],
      portfolioDecision: clampText(portfolioDecision, 500),
    };
  });
}

export function formatTradingAgentsNote(decision: TradingAgentsDecision, analysisDate: string, depth: TradingAgentsDepth) {
  return [
    `TradingAgents multi-agent debate for ${decision.symbol}`,
    "",
    `Analysis date: ${analysisDate}`,
    `Depth: ${depth}`,
    `Rating: ${decision.rating}`,
    `Action: ${decision.action}`,
    "",
    "Thesis",
    decision.thesis,
    "",
    "Portfolio manager decision",
    decision.portfolioDecision,
    "",
    "Risks",
    ...decision.risks.map((risk) => `- ${risk}`),
    "",
    "Boundary",
    "Research-only output. This is not financial advice and cannot place broker orders.",
  ]
    .join("\n")
    .slice(0, 5000);
}

function findDecisionRecords(data: unknown): Array<Record<string, unknown>> {
  const root = asRecord(data);
  const candidates = [
    root?.decisions,
    root?.results,
    root?.analyses,
    root?.data,
    asRecord(root?.data)?.decisions,
    asRecord(root?.data)?.results,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
    if (isRecord(candidate)) {
      const nested = Object.values(candidate).filter(isRecord);
      if (nested.length) return nested;
      return [candidate];
    }
  }
  return root ? [root] : [];
}

function readString(record: unknown, keys: string[]): string | null {
  const item = asRecord(record);
  if (!item) return null;
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (isRecord(value)) {
      const nested = readString(value, ["text", "summary", "decision", "rating", "content"]);
      if (nested) return nested;
    }
  }
  return null;
}

function readStringArray(record: unknown, keys: string[]): string[] {
  const item = asRecord(record);
  if (!item) return [];
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value.map((entry) => (typeof entry === "string" ? entry : stringifyForNote(entry))).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n|;/)
        .map((entry) => entry.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeActionFromRating(rating: string): string {
  const normalized = rating.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("overweight")) return "Research Buy Watch";
  if (normalized.includes("sell") || normalized.includes("underweight")) return "Research Sell/Avoid Watch";
  return "Research Hold";
}

function stringifyForNote(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clampText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
