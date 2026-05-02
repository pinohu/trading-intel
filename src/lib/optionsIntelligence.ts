import { getOptionContracts, getOptionSnapshots, type BrokerMode } from "@/lib/broker";
import { databaseConfigured } from "@/lib/db";
import { insertOptionVolatilitySnapshot } from "@/lib/persistence";

export type OptionVolatilityReport = {
  symbol: string;
  feed: "opra" | "indicative" | "contract-only" | "unavailable";
  dataQuality: "licensed-opra" | "indicative-delayed" | "contracts-only" | "unavailable";
  metrics: {
    contractsChecked: number;
    nearAtmContracts: number;
    callOpenInterest: number;
    putOpenInterest: number;
    putCallOpenInterestRatio: number | null;
    avgImpliedVolatility: number | null;
    skewHint: string;
    expirationWindow: string;
  };
  contracts: Array<Record<string, unknown>>;
  warnings: string[];
  storedSnapshot?: Record<string, unknown> | null;
};

type ContractResponse = {
  option_contracts?: Array<Record<string, unknown>>;
};

type SnapshotResponse = {
  snapshots?: Record<string, Record<string, unknown>>;
};

export async function buildOptionsVolatilityReports({
  symbols,
  mode,
  persist = false,
}: {
  symbols: string[];
  mode?: BrokerMode;
  persist?: boolean;
}): Promise<OptionVolatilityReport[]> {
  const reports = await Promise.all(symbols.slice(0, 8).map((symbol) => buildSymbolReport(symbol, mode)));
  if (persist && databaseConfigured()) {
    await Promise.all(
      reports.map(async (report) => {
        report.storedSnapshot = await insertOptionVolatilitySnapshot({
          symbol: report.symbol,
          feed: report.feed,
          dataQuality: report.dataQuality,
          metrics: report.metrics,
          contracts: report.contracts,
        }).catch((error) => ({ error: error instanceof Error ? error.message : "Options snapshot storage failed." }));
      }),
    );
  }
  return reports;
}

async function buildSymbolReport(symbol: string, mode?: BrokerMode): Promise<OptionVolatilityReport> {
  try {
    const contractsData = (await getOptionContracts([symbol], mode, "status=active&limit=100")) as ContractResponse;
    const contracts = (contractsData.option_contracts ?? []).filter((contract) => text(contract, "underlying_symbol") === symbol);
    if (contracts.length === 0) return unavailable(symbol, "No active option contracts returned by Alpaca.");

    const selected = selectNearContracts(contracts);
    let snapshots: SnapshotResponse["snapshots"] = {};
    let feed: OptionVolatilityReport["feed"] = "contract-only";
    try {
      const snapshotData = (await getOptionSnapshots(selected.map((contract) => text(contract, "symbol")).filter(Boolean), mode)) as SnapshotResponse;
      snapshots = snapshotData.snapshots ?? {};
      feed = Object.keys(snapshots).length > 0 ? "opra" : "contract-only";
    } catch {
      feed = "contract-only";
    }

    const enriched = selected.map((contract) => ({
      ...contract,
      snapshot: snapshots[text(contract, "symbol")] ?? null,
    }));
    const callOpenInterest = sumOpenInterest(enriched, "call");
    const putOpenInterest = sumOpenInterest(enriched, "put");
    const ivs = enriched.map(impliedVolatility).filter((value): value is number => value !== null);
    const putCallOpenInterestRatio = callOpenInterest > 0 ? Number((putOpenInterest / callOpenInterest).toFixed(3)) : null;
    return {
      symbol,
      feed,
      dataQuality: feed === "opra" ? "licensed-opra" : "contracts-only",
      metrics: {
        contractsChecked: contracts.length,
        nearAtmContracts: enriched.length,
        callOpenInterest,
        putOpenInterest,
        putCallOpenInterestRatio,
        avgImpliedVolatility: ivs.length ? Number((ivs.reduce((sum, value) => sum + value, 0) / ivs.length).toFixed(4)) : null,
        skewHint: skewHint(putCallOpenInterestRatio),
        expirationWindow: expirationWindow(enriched),
      },
      contracts: enriched.slice(0, 24),
      warnings: [
        feed !== "opra" ? "OPRA snapshots were unavailable; output is based on contracts/open-interest context only." : "",
        "Options are high-risk and require options approval; this is volatility context, not an options trade instruction.",
      ].filter(Boolean),
    };
  } catch (error) {
    return unavailable(symbol, error instanceof Error ? error.message : "Options data unavailable.");
  }
}

function selectNearContracts(contracts: Array<Record<string, unknown>>) {
  const now = Date.now();
  return [...contracts]
    .filter((contract) => {
      const expiration = Date.parse(text(contract, "expiration_date"));
      const days = Number.isFinite(expiration) ? (expiration - now) / 86_400_000 : 999;
      return days >= 3 && days <= 60;
    })
    .sort((a, b) => {
      const aExpiration = text(a, "expiration_date");
      const bExpiration = text(b, "expiration_date");
      if (aExpiration !== bExpiration) return aExpiration.localeCompare(bExpiration);
      return Math.abs(number(a, "strike_price")) - Math.abs(number(b, "strike_price"));
    })
    .slice(0, 40);
}

function sumOpenInterest(contracts: Array<Record<string, unknown>>, type: string) {
  return contracts
    .filter((contract) => text(contract, "type") === type)
    .reduce((sum, contract) => sum + number(contract, "open_interest"), 0);
}

function impliedVolatility(contract: Record<string, unknown>) {
  const snapshot = contract.snapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  const greeks = (snapshot as Record<string, unknown>).greeks;
  if (!greeks || typeof greeks !== "object") return null;
  const value = (greeks as Record<string, unknown>).iv ?? (greeks as Record<string, unknown>).implied_volatility;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function expirationWindow(contracts: Array<Record<string, unknown>>) {
  const dates = contracts.map((contract) => text(contract, "expiration_date")).filter(Boolean).sort();
  if (dates.length === 0) return "unknown";
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;
}

function skewHint(ratio: number | null) {
  if (ratio === null) return "Put/call context unavailable.";
  if (ratio >= 1.5) return "Put open interest is heavy; check downside hedge or fear context.";
  if (ratio <= 0.6) return "Call open interest dominates; check crowding and upside-chase risk.";
  return "Put/call open interest is balanced.";
}

function unavailable(symbol: string, reason: string): OptionVolatilityReport {
  return {
    symbol,
    feed: "unavailable",
    dataQuality: "unavailable",
    metrics: {
      contractsChecked: 0,
      nearAtmContracts: 0,
      callOpenInterest: 0,
      putOpenInterest: 0,
      putCallOpenInterestRatio: null,
      avgImpliedVolatility: null,
      skewHint: "Unavailable.",
      expirationWindow: "unknown",
    },
    contracts: [],
    warnings: [reason],
  };
}

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function number(record: Record<string, unknown>, key: string) {
  const parsed = Number(record[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}
