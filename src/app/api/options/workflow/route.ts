import { NextResponse } from "next/server";
import { getOptionContracts, getOptionSnapshots } from "@/lib/broker";
import { brokerUpstreamError, cleanSymbols, modeFromRequest, requireBrokerCredentials } from "@/lib/brokerRoutes";
import { parseNumberParam } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = modeFromRequest(request);
  const url = new URL(request.url);
  const { response } = await requireBrokerCredentials(mode);
  if (response) return response;

  const underlyingSymbols = cleanSymbols(url.searchParams.get("symbols") ?? "SPY,QQQ,NVDA", 10);
  const minDays = Math.round(parseNumberParam(url.searchParams.get("minDays"), 7, 1, 365));
  const maxDays = Math.round(parseNumberParam(url.searchParams.get("maxDays"), 45, minDays, 730));
  const side = url.searchParams.get("side")?.toLowerCase() === "put" ? "put" : "call";
  const limit = Math.round(parseNumberParam(url.searchParams.get("limit"), 100, 1, 500));
  const now = new Date();
  const expirationAfter = new Date(now.getTime() + minDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expirationBefore = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = new URLSearchParams({
    status: "active",
    type: side,
    expiration_date_gte: expirationAfter,
    expiration_date_lte: expirationBefore,
    limit: String(limit),
  });

  try {
    const contractsResponse = await getOptionContracts(underlyingSymbols, mode, query.toString());
    const contracts = extractContracts(contractsResponse);
    const contractSymbols = contracts.slice(0, 40).map((contract) => String(contract.symbol ?? contract.id ?? "")).filter(Boolean);
    const snapshots = contractSymbols.length ? await getOptionSnapshots(contractSymbols, mode).catch(() => null) : null;
    const ranked = contracts
      .map((contract) => optionCandidate(contract, snapshots))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      mode,
      side,
      underlyingSymbols,
      expirationWindow: { minDays, maxDays, expirationAfter, expirationBefore },
      candidates: ranked,
      executionWorkflow: [
        "Use the contract candidate only after the stock signal agrees with your trade thesis.",
        "Use limit orders only.",
        "Keep defined max loss smaller than the configured daily loss cap.",
        "Avoid contracts with stale snapshots, wide spreads, or unclear open interest.",
      ],
      liveExecutionEnabled: false,
      note: "This is an options workflow and data scanner. Options order placement remains gated until the exact contract, permissions, and risk acknowledgement are implemented.",
    });
  } catch (error) {
    return brokerUpstreamError(error, mode, "Options workflow failed.");
  }
}

function extractContracts(response: Record<string, unknown>) {
  const contracts = response.option_contracts ?? response.contracts ?? response.data ?? [];
  return Array.isArray(contracts) ? (contracts as Array<Record<string, unknown>>) : [];
}

function optionCandidate(contract: Record<string, unknown>, snapshots: unknown) {
  const symbol = String(contract.symbol ?? contract.id ?? "");
  const expiration = String(contract.expiration_date ?? "");
  const strike = Number(contract.strike_price ?? 0);
  const snapshot = snapshotFor(symbol, snapshots);
  const latestQuote = objectField(snapshot, "latestQuote") ?? objectField(snapshot, "latest_quote");
  const latestTrade = objectField(snapshot, "latestTrade") ?? objectField(snapshot, "latest_trade");
  const bid = Number(latestQuote?.bp ?? 0);
  const ask = Number(latestQuote?.ap ?? 0);
  const midpoint = bid > 0 && ask > 0 ? (bid + ask) / 2 : Number(latestTrade?.p ?? 0);
  const spreadPct = midpoint > 0 && ask > bid ? ((ask - bid) / midpoint) * 100 : 99;
  const openInterest = Number(snapshot?.openInterest ?? snapshot?.open_interest ?? contract.open_interest ?? 0);
  const score = Math.max(1, Math.min(100, Math.round(75 - spreadPct * 2 + Math.log10(Math.max(openInterest, 1)) * 8)));
  return {
    symbol,
    underlying: contract.underlying_symbol ?? "",
    type: contract.type ?? "",
    expiration,
    strike,
    bid,
    ask,
    midpoint: Number(midpoint.toFixed(2)),
    spreadPct: Number(spreadPct.toFixed(2)),
    openInterest,
    score,
    blockers: [
      spreadPct > 20 ? "Spread is wide." : "",
      midpoint <= 0 ? "No usable option price snapshot." : "",
      openInterest > 0 && openInterest < 100 ? "Open interest is thin." : "",
    ].filter(Boolean),
  };
}

function snapshotFor(symbol: string, snapshots: unknown) {
  if (!snapshots || typeof snapshots !== "object") return null;
  const root = snapshots as Record<string, unknown>;
  const data = root.snapshots && typeof root.snapshots === "object" ? (root.snapshots as Record<string, unknown>) : root;
  const item = data[symbol];
  return item && typeof item === "object" ? (item as Record<string, unknown>) : null;
}

function objectField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
