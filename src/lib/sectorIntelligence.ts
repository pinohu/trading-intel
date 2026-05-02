import type { AlgorithmCouncilScore } from "@/lib/factorEngine";

export type SectorRelativeRank = {
  symbol: string;
  sector: string;
  sectorPeerCount: number;
  sectorRank: number;
  sectorPercentile: number;
  interpretation: string;
};

const sectorMap: Record<string, string> = {
  AAPL: "Technology",
  MSFT: "Technology",
  NVDA: "Technology",
  AMD: "Technology",
  QQQ: "Technology-heavy ETF",
  TSLA: "Consumer Discretionary",
  COIN: "Financial Technology",
  JPM: "Financials",
  BAC: "Financials",
  XOM: "Energy",
  CVX: "Energy",
  GLD: "Commodity ETF",
  SLV: "Commodity ETF",
  USO: "Commodity ETF",
  UNG: "Commodity ETF",
  SPY: "Broad Market ETF",
};

export function sectorForSymbol(symbol: string) {
  return sectorMap[symbol.toUpperCase()] ?? "Unclassified";
}

export function buildSectorRelativeRanks(scores: AlgorithmCouncilScore[]): SectorRelativeRank[] {
  const groups = new Map<string, AlgorithmCouncilScore[]>();
  for (const score of scores) {
    const sector = sectorForSymbol(score.symbol);
    groups.set(sector, [...(groups.get(sector) ?? []), score]);
  }

  return scores.map((score) => {
    const sector = sectorForSymbol(score.symbol);
    const peers = [...(groups.get(sector) ?? [])].sort((a, b) => b.ensembleScore - a.ensembleScore);
    const rank = Math.max(1, peers.findIndex((peer) => peer.symbol === score.symbol) + 1);
    const percentile = peers.length > 1 ? Math.round(((peers.length - rank) / (peers.length - 1)) * 100) : 50;
    return {
      symbol: score.symbol,
      sector,
      sectorPeerCount: peers.length,
      sectorRank: rank,
      sectorPercentile: percentile,
      interpretation:
        peers.length < 3
          ? "Small peer set; treat as a bucket check, not a full sector rank."
          : percentile >= 70
            ? "Ranks strongly against current sector peers in the watchlist."
            : percentile <= 30
              ? "Ranks weakly against current sector peers in the watchlist."
              : "Ranks near the middle of current sector peers.",
    };
  });
}
