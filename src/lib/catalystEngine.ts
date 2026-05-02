import { databaseConfigured } from "@/lib/db";
import { marketEvents } from "@/lib/events";
import { fetchFundamentalSnapshot } from "@/lib/fundamentals";
import { insertCatalystEvents } from "@/lib/persistence";
import { symbolsParam } from "@/lib/requestGuards";

export type CatalystEvent = {
  symbol: string;
  eventType: "filing" | "news" | "macro" | "commodity";
  title: string;
  importance: number;
  source: string;
  eventTime: string | null;
  plainImpact: string;
  payload: Record<string, unknown>;
};

type NewsResponse = {
  items?: Array<{
    title?: string;
    link?: string;
    source?: string;
    publishedAt?: string;
    symbol?: string;
  }>;
};

export async function buildCatalystReport({
  request,
  origin,
  symbols,
  persist = false,
}: {
  request: Request;
  origin: string;
  symbols: string[];
  persist?: boolean;
}) {
  const [news, filings] = await Promise.all([
    fetchNewsCatalysts(request, origin, symbols),
    fetchFilingCatalysts(symbols),
  ]);
  const macro = macroCatalysts(symbols);
  const events = [...filings, ...news, ...macro].sort((a, b) => b.importance - a.importance);
  const stored =
    persist && databaseConfigured()
      ? await insertCatalystEvents(
          events.slice(0, 80).map((event) => ({
            symbol: event.symbol,
            eventType: event.eventType,
            title: event.title,
            importance: event.importance,
            source: event.source,
            eventTime: event.eventTime,
            payload: { ...event.payload, plainImpact: event.plainImpact },
          })),
        ).catch((error) => [{ error: error instanceof Error ? error.message : "Catalyst persistence failed." }])
      : [];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    symbols,
    events,
    topCatalysts: events.slice(0, 10),
    stored,
    advisory:
      "Catalysts explain why a signal may matter now. They do not make a trade safe without price trigger, risk ticket, and outcome proof.",
  };
}

async function fetchNewsCatalysts(request: Request, origin: string, symbols: string[]): Promise<CatalystEvent[]> {
  const url = new URL("/api/news", origin);
  url.searchParams.set("symbols", symbolsParam(symbols.slice(0, 12)));
  try {
    const response = await fetch(url, {
      headers: request.headers,
      cache: "no-store",
    });
    const data = (await response.json()) as NewsResponse;
    return (data.items ?? []).slice(0, 40).map((item) => {
      const symbol = String(item.symbol ?? "MARKET").toUpperCase();
      const importance = catalystImportance(item.title ?? "", "news");
      return {
        symbol,
        eventType: "news",
        title: item.title ?? "Market headline",
        importance,
        source: item.source ?? "News",
        eventTime: item.publishedAt ?? null,
        plainImpact: importance >= 75 ? "Fresh headline risk may dominate the chart." : "Headline context should be checked before acting.",
        payload: { link: item.link ?? null },
      };
    });
  } catch {
    return [];
  }
}

export async function fetchFilingCatalysts(symbols: string[]): Promise<CatalystEvent[]> {
  const results = await Promise.all(
    symbols.slice(0, 10).map(async (symbol) => {
      const fundamentals = await fetchFundamentalSnapshot(symbol);
      if (!fundamentals.cik) return [];
      const filings = await fetchSecSubmissions(fundamentals.cik);
      return filings.map((filing): CatalystEvent => {
        const form = String(filing.form ?? "SEC filing");
        return {
          symbol,
          eventType: "filing",
          title: `${form}: ${String(filing.primaryDocument ?? "recent filing")}`,
          importance: catalystImportance(form, "filing"),
          source: "SEC EDGAR submissions",
          eventTime: typeof filing.filingDate === "string" ? filing.filingDate : null,
          plainImpact: plainFilingImpact(form),
          payload: filing,
        };
      });
    }),
  );
  return results.flat();
}

async function fetchSecSubmissions(cik: string) {
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": process.env.SEC_USER_AGENT ?? "trading-intel-platform contact@example.com",
    },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    filings?: {
      recent?: Record<string, unknown[]>;
    };
  };
  const recent = data.filings?.recent ?? {};
  const forms = recent.form ?? [];
  return forms
    .map((form, index) => ({
      form,
      filingDate: recent.filingDate?.[index],
      reportDate: recent.reportDate?.[index],
      accessionNumber: recent.accessionNumber?.[index],
      primaryDocument: recent.primaryDocument?.[index],
    }))
    .filter((item) => ["10-K", "10-Q", "8-K", "4", "13F-HR", "S-3", "S-1"].includes(String(item.form)))
    .slice(0, 5);
}

function macroCatalysts(symbols: string[]): CatalystEvent[] {
  return marketEvents
    .filter((event) => symbols.some((symbol) => `${event.market} ${event.name}`.toUpperCase().includes(symbol.toUpperCase())) || event.market === "Stocks")
    .slice(0, 12)
    .map((event) => ({
      symbol: event.market === "Stocks" ? "MARKET" : event.market.split("/")[0].trim().toUpperCase(),
      eventType: event.market === "Stocks" ? "macro" : "commodity",
      title: event.name,
      importance: event.risk === "High" ? 85 : 60,
      source: "Trading platform event calendar",
      eventTime: null,
      plainImpact: event.check,
      payload: event,
    }));
}

function catalystImportance(text: string, type: CatalystEvent["eventType"]) {
  const upper = text.toUpperCase();
  let score = type === "filing" ? 65 : 45;
  if (upper.includes("10-K") || upper.includes("10-Q") || upper.includes("EARNINGS")) score += 20;
  if (upper.includes("8-K") || upper.includes("GUIDANCE") || upper.includes("MERGER") || upper.includes("BANKRUPTCY")) score += 25;
  if (upper.includes("INSIDER") || upper.includes("FORM 4") || upper === "4") score += 15;
  return Math.max(1, Math.min(100, score));
}

function plainFilingImpact(form: string) {
  if (form === "10-K" || form === "10-Q") return "Fresh official financials can change the fundamental score and should be reviewed before trading.";
  if (form === "8-K") return "A material company event may override technical signals.";
  if (form === "4") return "Insider transaction context may affect sentiment but needs interpretation.";
  return "Recent filing should be reviewed before relying on the signal.";
}
