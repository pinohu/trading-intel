import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  symbol: string;
  provider: string;
};

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function extractYahooItems(xml: string, symbol: string): NewsItem[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))
    .slice(0, 8)
    .map((match) => {
      const block = match[1];
      const title = stripCdata(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Market update");
      const link = stripCdata(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      const publishedAt = stripCdata(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");
      return { title, link, publishedAt, symbol, source: "Yahoo Finance RSS", provider: "yahoo-rss" };
    })
    .filter((item) => item.link);
}

async function fetchBenzingaNews(symbols: string[]) {
  const apiKey = process.env.BENZINGA_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({
    token: apiKey,
    tickers: symbols.join(","),
    pageSize: "25",
    displayOutput: "full",
  });
  const response = await fetch(`https://api.benzinga.com/api/v2/news?${params}`, { cache: "no-store" });
  if (!response.ok) return [];
  const data = (await response.json()) as Array<Record<string, unknown>>;
  return data.slice(0, 25).map((item): NewsItem => {
    const stocks = Array.isArray(item.stocks) ? item.stocks : [];
    const symbol = String((stocks[0] as { name?: string } | undefined)?.name ?? symbols[0] ?? "MARKET").toUpperCase();
    return {
      title: String(item.title ?? "Benzinga news"),
      link: String(item.url ?? ""),
      source: "Benzinga",
      publishedAt: String(item.created ?? item.updated ?? new Date().toISOString()),
      symbol,
      provider: "benzinga",
    };
  }).filter((item) => item.link || item.title);
}

async function fetchFinnhubNews(symbols: string[]) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
  const settled = await Promise.allSettled(
    symbols.slice(0, 8).map(async (symbol) => {
      const response = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&${range}&token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return [];
      const data = (await response.json()) as Array<Record<string, unknown>>;
      return data.slice(0, 8).map((item): NewsItem => ({
        title: String(item.headline ?? "Finnhub company news"),
        link: String(item.url ?? ""),
        source: String(item.source ?? "Finnhub"),
        publishedAt: item.datetime ? new Date(Number(item.datetime) * 1000).toISOString() : new Date().toISOString(),
        symbol,
        provider: "finnhub",
      })).filter((item) => item.link);
    }),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function fetchNewsApiItems(symbols: string[]) {
  const apiKey = process.env.NEWSAPI_API_KEY;
  if (!apiKey) return [];
  const query = symbols.slice(0, 6).join(" OR ");
  const params = new URLSearchParams({
    q: query,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "25",
    apiKey,
  });
  const response = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    cache: "no-store",
    headers: { "user-agent": "trading-intel-platform" },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { articles?: Array<Record<string, unknown>> };
  return (data.articles ?? []).slice(0, 25).map((item): NewsItem => {
    const title = String(item.title ?? "Market news");
    const symbol = symbols.find((candidate) => title.toUpperCase().includes(candidate)) ?? symbols[0] ?? "MARKET";
    const source = item.source && typeof item.source === "object" ? String((item.source as Record<string, unknown>).name ?? "NewsAPI") : "NewsAPI";
    return {
      title,
      link: String(item.url ?? ""),
      source,
      publishedAt: String(item.publishedAt ?? new Date().toISOString()),
      symbol,
      provider: "newsapi",
    };
  }).filter((item) => item.link);
}

async function fetchYahooRss(symbols: string[]) {
  const settled = await Promise.allSettled(
    symbols.slice(0, 6).map(async (symbol) => {
      const response = await fetch(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`RSS ${symbol}: ${response.status}`);
      return extractYahooItems(await response.text(), symbol);
    }),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "SPY,NVDA,TSLA,AAPL")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12);
  const provider = searchParams.get("provider")?.trim().toLowerCase() ?? "auto";
  const providerFns =
    provider === "benzinga"
      ? [fetchBenzingaNews]
      : provider === "finnhub"
        ? [fetchFinnhubNews]
        : provider === "newsapi"
          ? [fetchNewsApiItems]
          : [fetchBenzingaNews, fetchFinnhubNews, fetchNewsApiItems, fetchYahooRss];

  const settled = await Promise.allSettled(providerFns.map((fn) => fn(symbols)));
  const items = dedupeNews(settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))).slice(0, 40);
  return NextResponse.json({
    items,
    degraded: items.length === 0 || items.every((item) => item.provider === "yahoo-rss"),
    provider,
    providers: {
      benzinga: Boolean(process.env.BENZINGA_API_KEY),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      newsapi: Boolean(process.env.NEWSAPI_API_KEY),
      yahooRssFallback: true,
    },
  });
}

function dedupeNews(items: NewsItem[]) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item) => {
      const key = `${item.provider}:${item.link || item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
