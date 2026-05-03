export const marketEvents = [
  { market: "Stocks", name: "FOMC / Fed speakers", risk: "High", cadence: "Scheduled", check: "Do not day trade through surprise rate commentary without a specific volatility plan.", freeDataSource: "Federal Reserve public calendar" },
  { market: "Stocks", name: "CPI / PPI / jobs data", risk: "High", cadence: "Monthly", check: "Reduce size or wait for spread and range normalization after release.", freeDataSource: "BLS public releases" },
  { market: "Stocks", name: "Earnings", risk: "High", cadence: "Quarterly", check: "Avoid stale technical signals when earnings or guidance dominates the tape.", freeDataSource: "Company IR pages and SEC 8-K/10-Q/10-K filings" },
  { market: "Oil / USO / OIL", name: "EIA crude inventory", risk: "High", cadence: "Weekly", check: "Expect volatility and headline reversals around inventory data.", freeDataSource: "EIA Open Data" },
  { market: "Natural gas / UNG / NATGAS", name: "EIA natural gas storage", risk: "High", cadence: "Weekly", check: "Weather and storage surprises can overwhelm chart signals.", freeDataSource: "EIA Open Data" },
  { market: "Gold / GLD / GOLD", name: "Dollar, real yields, Fed events", risk: "Medium", cadence: "Daily", check: "Confirm dollar/yield context before trusting momentum.", freeDataSource: "Public Treasury/Federal Reserve context" },
  { market: "Silver / SLV / SILVER", name: "Dollar, industrial demand, rates", risk: "Medium", cadence: "Daily", check: "Silver can move like both a metal and a risk asset; confirm the driver first.", freeDataSource: "Public macro and ETF proxy context" },
  { market: "Copper / CPER / COPPER", name: "China growth and industrial demand", risk: "Medium", cadence: "Daily", check: "Confirm macro and demand context before trusting momentum.", freeDataSource: "Public macro and ETF proxy context" },
  { market: "Agriculture / DBA / CORN / WHEAT / SOY", name: "USDA / weather reports", risk: "High", cadence: "Scheduled/seasonal", check: "Weather and crop reports can gap commodity proxies beyond stops.", freeDataSource: "USDA NASS Quick Stats and public reports" },
];
