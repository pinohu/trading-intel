import type { SignalQuote } from "@/lib/signalEngine";

type SecTickerRecord = {
  cik_str: number;
  ticker: string;
  title: string;
};

type CompanyFacts = {
  cik: number;
  entityName: string;
  facts?: Record<string, Record<string, { units?: Record<string, SecFact[]> }>>;
};

type SecFact = {
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  start?: string;
  end?: string;
  frame?: string;
};

export type FundamentalSnapshot = {
  symbol: string;
  cik: string | null;
  name: string;
  source: "SEC CompanyFacts" | "Synthetic unavailable";
  updatedAt: string;
  dataQuality: "official-sec" | "partial-sec" | "unavailable";
  metrics: FundamentalMetrics;
  missing: string[];
  provenance: FundamentalProvenance;
};

export type FundamentalMetrics = {
  revenue: number | null;
  revenueGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roa: number | null;
  assetTurnover: number | null;
  debtToAssets: number | null;
  currentRatio: number | null;
  fcfMargin: number | null;
  earningsYield: number | null;
  salesYield: number | null;
  bookToMarket: number | null;
  assetGrowth: number | null;
  accrualsToAssets: number | null;
  piotroskiFScore: number | null;
  beneishMScore: number | null;
  beneishRisk: "low" | "elevated" | "high" | "unknown";
};

export type FundamentalProvenance = {
  basis: "annual-10-k" | "unavailable";
  latestFiscalYear: number | null;
  previousFiscalYear: number | null;
  latestFiledAt: string | null;
  previousFiledAt: string | null;
  sourceLimitations: string[];
  pointInTimeNote: string;
};

const tickerMapCache = { loadedAt: 0, records: new Map<string, SecTickerRecord>() };
const factsCache = new Map<string, { loadedAt: number; value: CompanyFacts | null }>();
const cacheMs = 1000 * 60 * 60 * 6;

const tagGroups = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  cogs: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  cfo: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "CapitalExpendituresIncurredButNotYetPaid"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  assetsCurrent: ["AssetsCurrent"],
  liabilitiesCurrent: ["LiabilitiesCurrent"],
  debt: ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent", "LongTermDebtNoncurrent", "LongTermDebt", "DebtCurrent"],
  shares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic", "CommonStocksIncludingAdditionalPaidInCapital"],
  receivables: ["AccountsReceivableNetCurrent", "AccountsReceivableNet"],
  sga: ["SellingGeneralAndAdministrativeExpense"],
  ppe: ["PropertyPlantAndEquipmentNet"],
  depreciation: ["DepreciationDepletionAndAmortization"],
};

export function canFetchSecFundamentals(symbol: string) {
  return /^[A-Z]{1,5}$/.test(symbol) && !["GLD", "SLV", "USO", "UNG", "DBA", "CPER"].includes(symbol);
}

export async function fetchFundamentalSnapshot(symbol: string, quote?: SignalQuote): Promise<FundamentalSnapshot> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!canFetchSecFundamentals(cleanSymbol)) {
    return unavailableSnapshot(cleanSymbol, quote?.name ?? cleanSymbol, ["SEC company fundamentals are only fetched for common U.S. equity tickers."]);
  }

  const record = await lookupTicker(cleanSymbol);
  if (!record) {
    return unavailableSnapshot(cleanSymbol, quote?.name ?? cleanSymbol, ["Ticker was not found in the SEC ticker-to-CIK map."]);
  }

  const cik = String(record.cik_str).padStart(10, "0");
  const facts = await fetchCompanyFacts(cik);
  if (!facts) {
    return unavailableSnapshot(cleanSymbol, record.title, ["SEC CompanyFacts request failed or returned no facts."], cik);
  }

  const annual = annualFactSet(facts);
  const latest = annual[0] ?? {};
  const previous = annual[1] ?? {};
  const latestShares = numberOrNull(latest.shares);
  const latestCfo = numberOrNull(latest.cfo);
  const latestCapex = numberOrNull(latest.capex);
  const marketCap = quote?.price && latestShares ? quote.price * latestShares : null;
  const freeCashFlow = latestCfo !== null && latestCapex !== null ? latestCfo - Math.abs(latestCapex) : null;
  const providerUpdatedAt = typeof latest.filed === "string" ? latest.filed : new Date().toISOString();
  const missing: string[] = [];
  const metrics: FundamentalMetrics = {
    revenue: value(latest.revenue),
    revenueGrowth: growth(latest.revenue, previous.revenue),
    grossMargin: ratio(value(latest.grossProfit) ?? marginNumerator(latest.revenue, latest.cogs), latest.revenue),
    operatingMargin: ratio(latest.operatingIncome, latest.revenue),
    netMargin: ratio(latest.netIncome, latest.revenue),
    roa: ratio(latest.netIncome, latest.assets),
    assetTurnover: ratio(latest.revenue, latest.assets),
    debtToAssets: ratio(latest.debt, latest.assets),
    currentRatio: ratio(latest.assetsCurrent, latest.liabilitiesCurrent),
    fcfMargin: ratio(freeCashFlow, latest.revenue),
    earningsYield: ratio(latest.netIncome, marketCap),
    salesYield: ratio(latest.revenue, marketCap),
    bookToMarket: ratio(latest.equity, marketCap),
    assetGrowth: growth(latest.assets, previous.assets),
    accrualsToAssets: accruals(latest.netIncome, latest.cfo, latest.assets),
    piotroskiFScore: piotroski(latest, previous),
    beneishMScore: beneish(latest, previous),
    beneishRisk: "unknown",
  };
  metrics.beneishRisk = beneishRisk(metrics.beneishMScore);

  for (const [key, metric] of Object.entries(metrics)) {
    if (metric === null || metric === "unknown") missing.push(key);
  }
  const provenance = buildProvenance(latest, previous, missing, metrics);

  return {
    symbol: cleanSymbol,
    cik,
    name: facts.entityName || record.title,
    source: "SEC CompanyFacts",
    updatedAt: providerUpdatedAt,
    dataQuality: missing.length > 8 ? "partial-sec" : "official-sec",
    metrics,
    missing,
    provenance,
  };
}

async function lookupTicker(symbol: string) {
  const now = Date.now();
  if (tickerMapCache.records.size && now - tickerMapCache.loadedAt < cacheMs) {
    return tickerMapCache.records.get(symbol) ?? null;
  }
  const response = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, SecTickerRecord>;
  const records = new Map<string, SecTickerRecord>();
  for (const record of Object.values(data)) {
    records.set(record.ticker.toUpperCase(), record);
  }
  tickerMapCache.loadedAt = now;
  tickerMapCache.records = records;
  return records.get(symbol) ?? null;
}

async function fetchCompanyFacts(cik: string) {
  const cached = factsCache.get(cik);
  if (cached && Date.now() - cached.loadedAt < cacheMs) return cached.value;
  const response = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  const value = response.ok ? ((await response.json()) as CompanyFacts) : null;
  factsCache.set(cik, { loadedAt: Date.now(), value });
  return value;
}

function annualFactSet(facts: CompanyFacts) {
  const rows = new Map<number, Record<string, number | string | null>>();
  for (const [name, tags] of Object.entries(tagGroups)) {
    const series = firstSeries(facts, tags);
    for (const item of series) {
      if (!item.fy || !Number.isFinite(item.val) || item.form !== "10-K") continue;
      const row = rows.get(item.fy) ?? { fy: item.fy, filed: item.filed ?? null };
      row[name] = Number(item.val);
      if (item.filed && (!row.filed || String(item.filed) > String(row.filed))) row.filed = item.filed;
      rows.set(item.fy, row);
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.fy) - Number(a.fy));
}

function firstSeries(facts: CompanyFacts, tags: string[]) {
  for (const tag of tags) {
    const units = facts.facts?.["us-gaap"]?.[tag]?.units;
    const values = units?.USD ?? units?.shares ?? units?.pure;
    if (values?.length) return values;
  }
  return [];
}

function piotroski(latest: Record<string, unknown>, previous: Record<string, unknown>) {
  const currentRoa = ratio(latest.netIncome, latest.assets);
  const previousRoa = ratio(previous.netIncome, previous.assets);
  const currentDebtAssets = ratio(latest.debt, latest.assets);
  const previousDebtAssets = ratio(previous.debt, previous.assets);
  const currentRatioValue = ratio(latest.assetsCurrent, latest.liabilitiesCurrent);
  const previousRatioValue = ratio(previous.assetsCurrent, previous.liabilitiesCurrent);
  const currentGrossMargin = ratio(value(latest.grossProfit) ?? marginNumerator(latest.revenue, latest.cogs), latest.revenue);
  const previousGrossMargin = ratio(value(previous.grossProfit) ?? marginNumerator(previous.revenue, previous.cogs), previous.revenue);
  const currentAssetTurnover = ratio(latest.revenue, latest.assets);
  const previousAssetTurnover = ratio(previous.revenue, previous.assets);
  const signals = [
    positive(latest.netIncome),
    positive(latest.cfo),
    currentRoa !== null && previousRoa !== null && currentRoa > previousRoa,
    value(latest.cfo) !== null && value(latest.netIncome) !== null && Number(latest.cfo) > Number(latest.netIncome),
    currentDebtAssets !== null && previousDebtAssets !== null && currentDebtAssets < previousDebtAssets,
    currentRatioValue !== null && previousRatioValue !== null && currentRatioValue > previousRatioValue,
    value(latest.shares) !== null && value(previous.shares) !== null && Number(latest.shares) <= Number(previous.shares) * 1.01,
    currentGrossMargin !== null && previousGrossMargin !== null && currentGrossMargin > previousGrossMargin,
    currentAssetTurnover !== null && previousAssetTurnover !== null && currentAssetTurnover > previousAssetTurnover,
  ];
  return signals.filter(Boolean).length;
}

function beneish(latest: Record<string, unknown>, previous: Record<string, unknown>) {
  const latestRevenue = value(latest.revenue);
  const previousRevenue = value(previous.revenue);
  const latestAssets = value(latest.assets);
  const previousAssets = value(previous.assets);
  if (
    latestRevenue === null ||
    previousRevenue === null ||
    latestAssets === null ||
    previousAssets === null ||
    latestRevenue === 0 ||
    previousRevenue === 0 ||
    latestAssets === 0 ||
    previousAssets === 0
  ) {
    return null;
  }

  const latestGross = latestRevenue - Math.abs(value(latest.cogs) ?? 0);
  const previousGross = previousRevenue - Math.abs(value(previous.cogs) ?? 0);
  const latestDepreciation = value(latest.depreciation) ?? 0;
  const previousDepreciation = value(previous.depreciation) ?? 0;
  const latestPpe = value(latest.ppe) ?? 0;
  const previousPpe = value(previous.ppe) ?? 0;
  const dsri = safeRatio(ratio(latest.receivables, latest.revenue), ratio(previous.receivables, previous.revenue), 1);
  const gmi = safeRatio(ratio(previousGross, previousRevenue), ratio(latestGross, latestRevenue), 1);
  const aqi = safeRatio(
    1 - safeNumber(latest.assetsCurrent) / latestAssets - safeNumber(latest.ppe) / latestAssets,
    1 - safeNumber(previous.assetsCurrent) / previousAssets - safeNumber(previous.ppe) / previousAssets,
    1,
  );
  const sgi = safeRatio(latestRevenue, previousRevenue, 1);
  const depi = safeRatio(
    ratio(previousDepreciation, previousDepreciation + previousPpe),
    ratio(latestDepreciation, latestDepreciation + latestPpe),
    1,
  );
  const sgai = safeRatio(ratio(latest.sga, latest.revenue), ratio(previous.sga, previous.revenue), 1);
  const lvgi = safeRatio(ratio(latest.liabilities, latest.assets), ratio(previous.liabilities, previous.assets), 1);
  const tata = accruals(latest.netIncome, latest.cfo, latest.assets) ?? 0;
  return Number((-4.84 + 0.92 * dsri + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi + 0.115 * depi - 0.172 * sgai + 4.679 * tata - 0.327 * lvgi).toFixed(3));
}

function beneishRisk(score: number | null) {
  if (score === null) return "unknown";
  if (score > -1.78) return "high";
  if (score > -2.22) return "elevated";
  return "low";
}

function unavailableSnapshot(symbol: string, name: string, missing: string[], cik: string | null = null): FundamentalSnapshot {
  return {
    symbol,
    cik,
    name,
    source: "Synthetic unavailable",
    updatedAt: new Date().toISOString(),
    dataQuality: "unavailable",
    metrics: {
      revenue: null,
      revenueGrowth: null,
      grossMargin: null,
      operatingMargin: null,
      netMargin: null,
      roa: null,
      assetTurnover: null,
      debtToAssets: null,
      currentRatio: null,
      fcfMargin: null,
      earningsYield: null,
      salesYield: null,
      bookToMarket: null,
      assetGrowth: null,
      accrualsToAssets: null,
      piotroskiFScore: null,
      beneishMScore: null,
      beneishRisk: "unknown",
    },
    missing,
    provenance: {
      basis: "unavailable",
      latestFiscalYear: null,
      previousFiscalYear: null,
      latestFiledAt: null,
      previousFiledAt: null,
      sourceLimitations: missing,
      pointInTimeNote: "No official SEC fundamental period was available for this symbol.",
    },
  };
}

async function secFetch(url: string) {
  return fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": process.env.SEC_USER_AGENT ?? "trading-intel-platform contact@example.com",
    },
  });
}

function growth(current: unknown, previous: unknown) {
  const a = value(current);
  const b = value(previous);
  if (a === null || b === null || b === 0) return null;
  return Number(((a - b) / Math.abs(b)).toFixed(4));
}

function ratio(numerator: unknown, denominator: unknown) {
  const a = value(numerator);
  const b = value(denominator);
  if (a === null || b === null || b === 0) return null;
  return Number((a / b).toFixed(4));
}

function accruals(netIncome: unknown, cfo: unknown, assets: unknown) {
  const income = value(netIncome);
  const cash = value(cfo);
  const assetValue = value(assets);
  if (income === null || cash === null || assetValue === null || assetValue === 0) return null;
  return Number(((income - cash) / assetValue).toFixed(4));
}

function value(input: unknown) {
  return numberOrNull(input);
}

function numberOrNull(input: unknown) {
  const parsed = typeof input === "number" || typeof input === "string" ? Number(input) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function marginNumerator(revenue: unknown, cogs: unknown) {
  const sales = value(revenue);
  const cost = value(cogs);
  if (sales === null || cost === null) return null;
  return sales - Math.abs(cost);
}

function positive(valueInput: unknown) {
  const parsed = value(valueInput);
  return parsed !== null && parsed > 0;
}

function safeRatio(a: number | null, b: number | null, fallback: number) {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

function safeNumber(input: unknown) {
  return value(input) ?? 0;
}

function buildProvenance(
  latest: Record<string, unknown>,
  previous: Record<string, unknown>,
  missing: string[],
  metrics: FundamentalMetrics,
): FundamentalProvenance {
  const limitations = [
    missing.length ? `${missing.length} fundamental fields are missing or not comparable.` : "",
    metrics.beneishRisk === "unknown" ? "Beneish accounting-risk score is incomplete because required SEC tags were unavailable." : "",
    "Live snapshots use the latest SEC CompanyFacts available at request time; historical backtests must enforce filed-date as-of rules.",
    "CompanyFacts can include restatements and amended filings; production-grade research should store accession-level filing lineage when added.",
  ].filter(Boolean);

  return {
    basis: "annual-10-k",
    latestFiscalYear: numberOrNull(latest.fy),
    previousFiscalYear: numberOrNull(previous.fy),
    latestFiledAt: typeof latest.filed === "string" ? latest.filed : null,
    previousFiledAt: typeof previous.filed === "string" ? previous.filed : null,
    sourceLimitations: limitations,
    pointInTimeNote: "This snapshot records the SEC filing dates used by the factor council so future outcome and backtest reviews can detect lookahead-risk mistakes.",
  };
}
