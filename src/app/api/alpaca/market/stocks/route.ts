import { NextResponse } from "next/server";
import { getAlpacaNews, getStockBars, getStockSnapshots } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbols, modeFromRequest, passthroughQuery, requireBrokerCredentials } from "@/lib/brokerRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  const kind = searchParams.get("kind")?.trim().toLowerCase() ?? "snapshots";
  const symbols = cleanSymbols(searchParams.get("symbols") ?? "SPY,QQQ,NVDA,TSLA,AAPL", 100);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, mode, error: "At least one stock symbol is required." }, { status: 400 });
  }

  try {
    if (kind === "bars") {
      const bars = await getStockBars(symbols, mode, passthroughQuery(searchParams, ["kind", "symbols"]));
      return NextResponse.json({ ok: true, mode, kind, symbols, bars });
    }
    if (kind === "news") {
      const news = await getAlpacaNews(symbols, mode, passthroughQuery(searchParams, ["kind", "symbols"]));
      return NextResponse.json({ ok: true, mode, kind, symbols, news });
    }

    const snapshots = await getStockSnapshots(symbols, mode, searchParams.get("feed") ?? undefined);
    return NextResponse.json({ ok: true, mode, kind: "snapshots", symbols, snapshots });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Alpaca stock market-data request failed.");
  }
}
