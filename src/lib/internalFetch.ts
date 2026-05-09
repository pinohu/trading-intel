import type { SignalQuote } from "@/lib/signalEngine";

export type MarketPayload = {
  quotes?: SignalQuote[];
  degraded?: boolean;
  provider?: string;
  unavailableSymbols?: string[];
  error?: string;
};

export async function fetchInternalMarket(request: Request, marketUrl: URL) {
  const response = await fetch(marketUrl, {
    cache: "no-store",
    headers: internalForwardHeaders(request),
  });
  const payload = await response.json().catch(() => null);
  const market = isMarketPayload(payload)
    ? payload
    : {
        quotes: [],
        degraded: true,
        error: "Market data response was not valid JSON.",
      };

  return {
    ok: response.ok,
    status: response.status,
    market,
  };
}

function internalForwardHeaders(request: Request) {
  const headers = new Headers();
  copyHeader(request, headers, "cookie");
  copyHeader(request, headers, "authorization");
  copyHeader(request, headers, "x-cron-secret");

  return headers;
}

function copyHeader(request: Request, headers: Headers, name: string) {
  const value = request.headers.get(name);
  if (value) headers.set(name, value);
}

function isMarketPayload(payload: unknown): payload is MarketPayload {
  return Boolean(payload && typeof payload === "object");
}
