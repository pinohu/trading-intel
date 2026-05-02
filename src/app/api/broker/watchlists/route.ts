import { NextResponse } from "next/server";
import { createWatchlist, getWatchlists } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbols, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";
import { hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  try {
    const watchlists = await getWatchlists(mode);
    return NextResponse.json({ ok: true, mode, watchlists });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker watchlists request failed.");
  }
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to create broker watchlists." }, { status: 401 });
  }

  const mode = modeFromRequest(request);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  const body = await request.json().catch(() => null) as { name?: string; symbols?: string[] | string } | null;
  const name = body?.name?.trim().slice(0, 80);
  const symbols = Array.isArray(body?.symbols) ? cleanSymbols(body.symbols.join(","), 100) : cleanSymbols(body?.symbols ?? "", 100);
  if (!name || symbols.length === 0) {
    return NextResponse.json({ ok: false, mode, error: "Watchlist name and at least one symbol are required." }, { status: 400 });
  }

  try {
    const watchlist = await createWatchlist(name, symbols, mode);
    return NextResponse.json({ ok: true, mode, watchlist }, { status: 201 });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Broker watchlist creation failed.");
  }
}
