import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { algorithmFamilies, rankAlgorithmCouncilScores, scoreAlgorithmCouncil } from "@/lib/factorEngine";
import { fetchFundamentalSnapshot } from "@/lib/fundamentals";
import { fetchInternalMarket } from "@/lib/internalFetch";
import { insertFactorSnapshot, insertFundamentalSnapshot } from "@/lib/persistence";
import { parseProvider, parseSymbols, symbolsParam } from "@/lib/requestGuards";
import { buildSectorRelativeRanks } from "@/lib/sectorIntelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"), 16);
  const provider = parseProvider(url.searchParams.get("provider"));
  const persist = url.searchParams.get("persist") !== "false";
  const marketUrl = new URL("/api/market", url.origin);
  marketUrl.searchParams.set("symbols", symbolsParam(symbols));
  marketUrl.searchParams.set("provider", provider);

  const { ok, status, market } = await fetchInternalMarket(request, marketUrl);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: market.error ?? "Market data unavailable; algorithm council skipped.", algorithms: algorithmFamilies, scores: [] },
      { status },
    );
  }

  const quotes = market.quotes ?? [];
  const results = await Promise.all(
    quotes.map(async (quote) => {
      const fundamentals = await fetchFundamentalSnapshot(quote.symbol, quote);
      const score = scoreAlgorithmCouncil({ quote, fundamentals });
      let storage: { fundamentalSnapshotId: string | null; factorSnapshotId: string | null; error: string | null } = {
        fundamentalSnapshotId: null,
        factorSnapshotId: null,
        error: null,
      };
      if (persist && databaseConfigured()) {
        try {
          const fundamentalSnapshotId = await insertFundamentalSnapshot(fundamentals);
          const factorSnapshotId = await insertFactorSnapshot(score, fundamentalSnapshotId);
          storage = { fundamentalSnapshotId, factorSnapshotId, error: null };
        } catch (error) {
          storage = {
            fundamentalSnapshotId: null,
            factorSnapshotId: null,
            error: error instanceof Error ? error.message : "Algorithm snapshot storage failed.",
          };
        }
      }
      return { fundamentals, score, storage };
    }),
  );

  const scores = rankAlgorithmCouncilScores(results.map((item) => item.score));
  const sectorRanks = buildSectorRelativeRanks(scores);
  const storage = {
    postgres: {
      attempted: persist && databaseConfigured(),
      factorSnapshots: results.filter((item) => item.storage.factorSnapshotId).length,
      errors: results.map((item) => item.storage.error).filter(Boolean),
    },
  };

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    provider,
    degraded: market.degraded ?? false,
    algorithms: algorithmFamilies,
    scores,
    sectorRanks,
    fundamentals: Object.fromEntries(results.map((item) => [item.score.symbol, item.fundamentals])),
    storage,
    advisory:
      "Algorithm Council scores combine SEC fundamentals, accounting-quality checks, and quote/tape context. They are research signals, not profit guarantees or autonomous trade instructions.",
  });
}
