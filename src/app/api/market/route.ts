import { NextResponse } from "next/server";
import { fetchProviderQuote } from "@/lib/providers";
import { parseProvider, parseSymbols } from "@/lib/requestGuards";
import { clientIp, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = rateLimit({
    key: `market:${clientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { quotes: [], degraded: true, error: "Rate limit exceeded. Slow down market refreshes." },
      { status: 429, headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const symbols = parseSymbols(searchParams.get("symbols"));
  const provider = parseProvider(searchParams.get("provider"));

  try {
    const settled = await Promise.allSettled(symbols.map((symbol, index) => fetchProviderQuote(symbol, index, provider)));
    const quotes = settled
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((quote) => quote !== null);
    const unavailableSymbols = symbols.filter((symbol) => !quotes.some((quote) => quote.symbol === symbol));
    if (quotes.length === 0) {
      return NextResponse.json(
        {
          quotes: [],
          degraded: true,
          provider,
          unavailableSymbols,
          error: "No market-data provider returned usable quotes. Live signals are disabled until data recovers.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      quotes,
      degraded: quotes.some(
        (quote) =>
          quote.quality !== "Execution Grade" &&
          quote.quality !== "Public Real-Time" &&
          quote.quality !== "Partial Market",
      ) || unavailableSymbols.length > 0,
      provider,
      unavailableSymbols,
    });
  } catch (error) {
    return NextResponse.json({
      quotes: [],
      degraded: true,
      provider,
      error: error instanceof Error ? error.message : "Unknown market-data error",
    }, { status: 503 });
  }
}
