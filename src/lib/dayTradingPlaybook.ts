export type PlaybookRule = {
  name: string;
  market: "Stocks" | "Commodities" | "Both";
  purpose: string;
  confirmation: string;
  avoidWhen: string;
};

export const dayTradingRules: PlaybookRule[] = [
  {
    name: "VWAP Trend Continuation",
    market: "Both",
    purpose: "Find intraday continuation when price holds above a fair-value proxy and closes strong in the session range.",
    confirmation: "Positive change, close in the upper third of the range, and above the VWAP proxy.",
    avoidWhen: "Price is already extended more than the normal intraday range or news is unclear.",
  },
  {
    name: "Opening Range Breakout",
    market: "Stocks",
    purpose: "Catch momentum when a liquid name breaks above the early session range with volume and market alignment.",
    confirmation: "Price near high of day, above open, strong liquidity, and broad index confirmation.",
    avoidWhen: "Breakout occurs into prior resistance, low volume, or immediately after a large gap.",
  },
  {
    name: "Failed Breakout / Exit Watch",
    market: "Both",
    purpose: "Protect capital when a move loses the range, fails to hold momentum, or becomes too extended.",
    confirmation: "Close location weakens, change turns sharply negative, or price rejects the high.",
    avoidWhen: "There is no written invalidation level or spread/liquidity is poor.",
  },
  {
    name: "Mean Reversion From Exhaustion",
    market: "Stocks",
    purpose: "Identify reversal candidates after excessive intraday extension.",
    confirmation: "Large move, close off the high/low, and target offers at least 1.5R.",
    avoidWhen: "The trend is news-driven or the symbol remains pinned near the extreme.",
  },
  {
    name: "Commodity Volatility Gate",
    market: "Commodities",
    purpose: "Avoid treating commodity ETFs and futures proxies like ordinary stocks during macro, inventory, weather, or geopolitical shocks.",
    confirmation: "Signal must have clean trend, clear invalidation, smaller risk unit, and no obvious scheduled event conflict.",
    avoidWhen: "Inventories, Fed events, OPEC/geopolitical headlines, crop/weather reports, or contract-roll distortions are active.",
  },
  {
    name: "Futures Proxy Session Check",
    market: "Commodities",
    purpose: "Keep direct commodity aliases such as GOLD, OIL, NATGAS, and WHEAT from being treated like normal stock tickers.",
    confirmation: "Quote comes from the commodity alias feed, data is fresh, and the trigger is not inside a thin overnight spike.",
    avoidWhen: "The contract is near roll, the spread is wide, or the move is happening around inventory/weather/news release windows.",
  },
  {
    name: "Risk First Position Sizing",
    market: "Both",
    purpose: "Keep one trade from damaging the account.",
    confirmation: "Every setup has max risk, stop/invalidation, target, and reward/risk before entry.",
    avoidWhen: "You are revenge trading, increasing size after a loss, or trading without a written thesis.",
  },
];

export const dayTradingBestPractices = [
  "Trade only liquid instruments with tight spreads and enough volume.",
  "Prefer A+ setups where trend, level, liquidity, catalyst, and risk/reward agree.",
  "Risk a small fixed percentage per idea; reduce risk for commodities and highly volatile names.",
  "Never enter without an invalidation level and target.",
  "Avoid trading during major scheduled events unless the plan explicitly accounts for volatility.",
  "Review losses by rule violation first, market randomness second.",
  "Use alerts as research prompts, not automatic orders.",
];
