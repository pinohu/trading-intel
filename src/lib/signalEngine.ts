export type SignalQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  source: string;
  quality?: "Execution Grade" | "Public Real-Time" | "Partial Market" | "Unofficial" | "Delayed" | "Offline";
  updatedAt: string;
  marketStatus?: string;
};

export type TradeSignal = {
  symbol: string;
  name: string;
  action: "Buy Watch" | "Sell/Exit Watch" | "Hold/No Trade";
  market: "Stock/ETF" | "Commodity ETF" | "Commodity Future" | "Crypto";
  setup: string;
  confidence: number;
  quality: "A" | "B" | "C" | "Avoid";
  urgency: "High" | "Medium" | "Low";
  price: number;
  invalidation: number;
  target: number;
  rewardRisk: number;
  positionRiskPct: number;
  reason: string;
  confirmations: string[];
  warnings: string[];
  dataFresh: boolean;
  dataAgeMinutes: number | null;
  marketStatus?: string;
  checklist: string[];
  generatedAt: string;
};

export type BuyLead = {
  symbol: string;
  name: string;
  status: "Buy Watch" | "Buy Lead - Wait for Trigger" | "No Buy";
  score: number;
  confidence: number;
  price: number;
  trigger: number;
  stop: number;
  target: number;
  rewardRisk: number;
  moveFromOpenPct: number;
  reason: string;
  simpleWhy: string[];
  warnings: string[];
  dataFresh: boolean;
  dataAgeMinutes: number | null;
  marketStatus?: string;
  generatedAt: string;
};

export type PlainDecision = {
  headline: string;
  symbol: string;
  plainAction: string;
  simpleWhy: string[];
  simpleRisk: string;
  simpleNextStep: string;
};

const commodityProxies = new Set(["GLD", "SLV", "USO", "UNG", "DBA", "CPER"]);
const commodityFutures = new Set(["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY"]);
const cryptoSymbols = new Set(["BTCUSD", "ETHUSD"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizedMarketStatus(quote: SignalQuote) {
  return quote.marketStatus?.trim() || undefined;
}

function regularTradingWindow(quote: SignalQuote) {
  if (cryptoSymbols.has(quote.symbol)) return true;
  const status = normalizedMarketStatus(quote);
  if (!status) return true;
  const lower = status.toLowerCase();
  return (lower.includes("open") || lower === "regular") && !lower.includes("after") && !lower.includes("pre");
}

function marketForSymbol(symbol: string): TradeSignal["market"] {
  if (cryptoSymbols.has(symbol)) return "Crypto";
  if (commodityFutures.has(symbol)) return "Commodity Future";
  if (commodityProxies.has(symbol)) return "Commodity ETF";
  return "Stock/ETF";
}

function isCommodityMarket(market: TradeSignal["market"]) {
  return market === "Commodity ETF" || market === "Commodity Future";
}

function quoteShape(quote: SignalQuote) {
  const price = Number.isFinite(quote.price) && quote.price > 0 ? quote.price : 1;
  const open = Number.isFinite(quote.open) && quote.open > 0 ? quote.open : price;
  const rawHigh = Number.isFinite(quote.high) && quote.high > 0 ? quote.high : price;
  const rawLow = Number.isFinite(quote.low) && quote.low > 0 ? quote.low : price;
  const hasRealRange = rawHigh > rawLow && rawHigh - rawLow >= Math.max(price * 0.001, 0.02);
  const high = hasRealRange ? Math.max(rawHigh, price, open) : Math.max(price, open) * 1.002;
  const low = hasRealRange ? Math.min(rawLow, price, open) : Math.min(price, open) * 0.998;
  const range = Math.max(high - low, price * 0.005);
  const closeLocation = clamp((price - low) / range, 0, 1);
  const vwapProxy = (high + low + price) / 3;
  const dayMovePct = open ? ((price - open) / open) * 100 : quote.changePct;
  return {
    open,
    high,
    low,
    range,
    closeLocation,
    vwapProxy,
    dayMovePct: Number.isFinite(dayMovePct) ? dayMovePct : quote.changePct,
    rangeEstimated: !hasRealRange,
  };
}

export function dataAgeMinutes(quote: SignalQuote) {
  const timestamp = Date.parse(quote.updatedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 60000);
}

export function isQuoteFreshEnough(quote: SignalQuote) {
  const age = dataAgeMinutes(quote);
  if (age === null) return false;
  if (cryptoSymbols.has(quote.symbol)) return age <= 5;
  if (commodityFutures.has(quote.symbol)) return age <= 20;
  if (quote.quality === "Execution Grade") return age <= 2;
  if (quote.quality === "Public Real-Time") return regularTradingWindow(quote) ? age <= 5 : age <= 20;
  if (quote.quality === "Partial Market") return age <= 5;
  return age <= 15;
}

export function scoreQuote(quote: SignalQuote) {
  const shape = quoteShape(quote);
  const trend = clamp(shape.dayMovePct * 4, -20, 20);
  const closeLocation = shape.closeLocation * 30;
  const liquidity = Math.min(20, Math.log10(Math.max(quote.volume, 1)) * 2);
  return Math.round(35 + trend + closeLocation + liquidity);
}

export function generateSignal(quote: SignalQuote, riskPct = 1): TradeSignal {
  const age = dataAgeMinutes(quote);
  const fresh = isQuoteFreshEnough(quote);
  const shape = quoteShape(quote);
  const range = shape.range;
  const closeLocation = shape.closeLocation;
  const aboveOpen = quote.price > shape.open;
  const aboveVwapProxy = quote.price >= shape.vwapProxy;
  const market = marketForSymbol(quote.symbol);
  const liquid = quote.volume >= 1_000_000 || market === "Commodity Future" || market === "Crypto";
  const score = scoreQuote(quote);
  const inTradingWindow = regularTradingWindow(quote);
  const strongMomentum = shape.dayMovePct >= 0.55 && closeLocation >= 0.66 && aboveOpen && aboveVwapProxy && liquid;
  const openingRangeBreakout = shape.dayMovePct >= 0.9 && closeLocation >= 0.78 && score >= 72;
  const exhaustionRisk = shape.dayMovePct <= -1.2 || closeLocation <= 0.18;
  const failedBreakout = shape.dayMovePct > 0.4 && closeLocation < 0.42;
  const extended = shape.dayMovePct >= (isCommodityMarket(market) ? 2.8 : market === "Crypto" ? 3.5 : 4.2) && closeLocation >= 0.84;
  const rawAction =
    (strongMomentum || openingRangeBreakout) && !extended
      ? "Buy Watch"
      : exhaustionRisk || failedBreakout || extended
        ? "Sell/Exit Watch"
        : "Hold/No Trade";
  const action = fresh && inTradingWindow ? rawAction : "Hold/No Trade";
  const setup =
    !fresh
      ? "Stale Data - No Trade"
      : !inTradingWindow
        ? `${normalizedMarketStatus(quote) ?? "Outside regular session"} - Wait`
      : action === "Buy Watch"
      ? openingRangeBreakout
        ? "Opening Range Breakout"
        : "VWAP Trend Continuation"
      : action === "Sell/Exit Watch"
        ? extended
          ? "Momentum Exhaustion"
          : failedBreakout
            ? "Failed Breakout"
            : "Breakdown / Exit Risk"
        : "No A+ Setup";
  const urgency = action === "Hold/No Trade" ? "Low" : score >= 78 || Math.abs(quote.changePct) >= 2.5 ? "High" : "Medium";
  const invalidation =
    action === "Buy Watch"
      ? Math.max(shape.low, Math.min(shape.open, quote.price - range * 0.42))
      : action === "Sell/Exit Watch"
        ? Math.min(shape.high, quote.price + range * 0.35)
        : shape.low;
  const target =
    action === "Buy Watch"
      ? quote.price + range * 0.85
      : action === "Sell/Exit Watch"
        ? quote.price - range * 0.65
        : quote.price;
  const riskDistance = Math.max(Math.abs(quote.price - invalidation), quote.price * 0.0025);
  const rewardRisk = Math.abs(target - quote.price) / riskDistance;
  const confirmations = [
    aboveOpen ? "Price above open" : "",
    aboveVwapProxy ? "Price above VWAP proxy" : "",
    closeLocation >= 0.66 ? "Close location strong" : "",
    liquid ? "Liquidity filter passed" : "",
    rewardRisk >= 1.5 ? "Reward/risk acceptable" : "",
  ].filter(Boolean);
  const warnings = [
    !fresh ? `Data is stale (${age === null ? "unknown age" : `${Math.round(age)} minutes old`})` : "",
    shape.rangeEstimated ? "Day range is estimated from limited public quote fields" : "",
    !inTradingWindow && fresh ? `${normalizedMarketStatus(quote) ?? "Market not in regular session"}: wait for cleaner regular-session confirmation` : "",
    !liquid ? "Liquidity below preferred day-trading threshold" : "",
    quote.quality && quote.quality !== "Execution Grade" ? `Feed is ${quote.quality}, not licensed execution-grade` : "",
    extended ? "Move may be extended; chase risk is elevated" : "",
    market === "Commodity ETF" ? "Commodity ETF: check macro, inventory, weather, roll, and geopolitical risk" : "",
    market === "Commodity Future" ? "Commodity future proxy: check contract roll, inventory, weather, OPEC/Fed, and geopolitical risk" : "",
    rewardRisk < 1.5 ? "Reward/risk is below preferred threshold" : "",
  ].filter(Boolean);
  const qualityScore =
    confirmations.length * 16 +
    (action === "Hold/No Trade" ? 0 : 12) +
    Math.min(18, Math.abs(quote.changePct) * 4) -
    warnings.length * 10;
  const quality = !fresh ? "Avoid" : qualityScore >= 76 ? "A" : qualityScore >= 58 ? "B" : qualityScore >= 40 ? "C" : "Avoid";
  const confidence = Math.max(
    1,
    Math.min(100, Math.round(score + confirmations.length * 5 + rewardRisk * 4 - warnings.length * 9 - (extended ? 16 : 0))),
  );
  const reason =
    !fresh
      ? "The latest stock data is not fresh enough for a real-time decision. Wait for fresh data."
      : !inTradingWindow
        ? "The market is outside the clean regular-session window. Keep it as a watch item and wait for confirmation."
      : action === "Buy Watch"
      ? "Multiple day-trading rules align: trend, range location, liquidity, and risk/reward. Confirm catalyst and thesis first."
      : action === "Sell/Exit Watch"
        ? "Exit/avoidance rules triggered from downside pressure, failed breakout, or extension risk."
        : "No clean edge from the current rule set. Preserve capital and wait.";

  return {
    symbol: quote.symbol,
    name: quote.name,
    action,
    market,
    setup,
    confidence,
    quality,
    urgency,
    price: quote.price,
    invalidation: Number(invalidation.toFixed(2)),
    target: Number(target.toFixed(2)),
    rewardRisk: Number(rewardRisk.toFixed(2)),
    positionRiskPct: isCommodityMarket(market) ? Number(Math.min(riskPct, 0.5).toFixed(2)) : riskPct,
    reason,
    confirmations,
    warnings,
    dataFresh: fresh,
    dataAgeMinutes: age === null ? null : Number(age.toFixed(1)),
    marketStatus: normalizedMarketStatus(quote),
    checklist: [
      "Check news/catalyst before acting.",
      "Confirm market/index or commodity macro context.",
      "Write thesis and invalidation in the journal.",
      "Do not exceed configured risk per idea.",
      "Treat delayed/public data as research, not execution-grade timing.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function generateBuyLead(quote: SignalQuote, riskPct = 1): BuyLead {
  const signal = generateSignal(quote, riskPct);
  const age = dataAgeMinutes(quote);
  const fresh = isQuoteFreshEnough(quote);
  const shape = quoteShape(quote);
  const market = marketForSymbol(quote.symbol);
  const liquid = quote.volume >= 1_000_000 || market === "Commodity Future" || market === "Crypto";
  const aboveOpen = quote.price > shape.open;
  const aboveVwapProxy = quote.price >= shape.vwapProxy;
  const inTradingWindow = regularTradingWindow(quote);
  const severeWeakness = shape.dayMovePct <= -1.6 || shape.closeLocation <= 0.18;
  const extended = shape.dayMovePct >= (isCommodityMarket(market) ? 2.8 : market === "Crypto" ? 3.5 : 4.2) && shape.closeLocation >= 0.85;
  const baseScore =
    scoreQuote(quote) +
    (fresh ? 12 : -35) +
    (liquid ? 10 : -10) +
    (aboveOpen ? 10 : -6) +
    (aboveVwapProxy ? 8 : -5) +
    (shape.closeLocation >= 0.58 ? 8 : -4) +
    (quote.quality === "Execution Grade" ? 8 : quote.quality === "Public Real-Time" ? 5 : 0) -
    (shape.rangeEstimated ? 4 : 0) -
    (extended ? 16 : 0) -
    (severeWeakness ? 22 : 0);
  const confidence = clamp(Math.round(baseScore), 1, 100);
  const status =
    signal.action === "Buy Watch" && (signal.quality === "A" || signal.quality === "B")
      ? "Buy Watch"
      : signal.action !== "Sell/Exit Watch" && fresh && liquid && !severeWeakness && !extended && confidence >= 45
        ? "Buy Lead - Wait for Trigger"
        : "No Buy";
  const trigger =
    status === "Buy Watch"
      ? quote.price
      : Math.max(quote.price * 1.002, shape.high * 1.001);
  const stop =
    status === "Buy Watch"
      ? signal.invalidation
      : Math.min(quote.price * 0.992, shape.low + shape.range * 0.18);
  const safeStop = Math.min(stop, trigger - Math.max(trigger * 0.0025, 0.02));
  const target = trigger + (trigger - safeStop) * 1.8;
  const rewardRisk = (target - trigger) / Math.max(trigger - safeStop, trigger * 0.0025);
  const simpleWhy = [
    aboveOpen ? "It is trading above where it opened." : "It still needs to prove strength above its open.",
    aboveVwapProxy ? "It is holding the stronger side of today's range." : "It has not clearly reclaimed the stronger side of today's range.",
    liquid ? "There is enough activity to monitor it closely." : "Trading activity is below the preferred threshold.",
    shape.closeLocation >= 0.58 ? "It is closer to the upper part of today's range." : "It is not yet near the stronger part of today's range.",
  ];
  const warnings = [
    !fresh ? `Data is stale (${age === null ? "unknown age" : `${Math.round(age)} minutes old`})` : "",
    !inTradingWindow && fresh ? `${normalizedMarketStatus(quote) ?? "Outside regular session"}: wait for cleaner entry timing` : "",
    shape.rangeEstimated ? "The day range is estimated, so the trigger needs extra confirmation" : "",
    !liquid ? "Liquidity is below the preferred day-trading threshold" : "",
    signal.action === "Sell/Exit Watch" ? "Sell/exit rules are active; do not treat this as a buy lead" : "",
    extended ? "The move is already stretched; avoid chasing" : "",
    severeWeakness ? "The chart is currently too weak for a buy lead" : "",
    market === "Commodity ETF" ? "Commodity ETF: confirm macro and inventory risk before acting" : "",
    market === "Commodity Future" ? "Commodity future proxy: confirm contract, roll, inventory/weather, and headline risk before acting" : "",
    quote.quality && quote.quality !== "Execution Grade" ? `Feed is ${quote.quality}, not licensed execution-grade` : "",
  ].filter(Boolean);
  const reason =
    status === "Buy Watch"
      ? "This is the strongest buy candidate in the current rule stack. Confirm the news and risk level before acting."
      : status === "Buy Lead - Wait for Trigger"
        ? `This is a buy lead, not a buy-now order. It needs to push through ${formatPlainMoney(trigger)} with fresh data before it becomes cleaner.`
        : signal.action === "Sell/Exit Watch"
          ? "This is not a buy candidate right now because sell/exit rules are active."
        : "This is not a buy candidate right now. Wait for strength, fresh data, and a cleaner trigger.";

  return {
    symbol: quote.symbol,
    name: quote.name,
    status,
    score: confidence,
    confidence,
    price: roundMoney(quote.price),
    trigger: roundMoney(trigger),
    stop: roundMoney(safeStop),
    target: roundMoney(target),
    rewardRisk: Number(rewardRisk.toFixed(2)),
    moveFromOpenPct: Number(shape.dayMovePct.toFixed(2)),
    reason,
    simpleWhy,
    warnings,
    dataFresh: fresh,
    dataAgeMinutes: age === null ? null : Number(age.toFixed(1)),
    marketStatus: normalizedMarketStatus(quote),
    generatedAt: new Date().toISOString(),
  };
}

export function generateBuyLeads(quotes: SignalQuote[], riskPct = 1) {
  const statusRank = { "Buy Watch": 3, "Buy Lead - Wait for Trigger": 2, "No Buy": 1 };
  return quotes
    .map((quote) => generateBuyLead(quote, riskPct))
    .sort((a, b) => {
      return (
        statusRank[b.status] - statusRank[a.status] ||
        Number(b.dataFresh) - Number(a.dataFresh) ||
        b.confidence - a.confidence ||
        b.rewardRisk - a.rewardRisk
      );
    });
}

export function generateSignals(quotes: SignalQuote[], riskPct = 1) {
  return quotes
    .map((quote) => generateSignal(quote, riskPct))
    .sort((a, b) => {
      const rank = { "Buy Watch": 3, "Sell/Exit Watch": 2, "Hold/No Trade": 1 };
      return rank[b.action] - rank[a.action] || b.confidence - a.confidence;
    });
}

export function explainPlain(signal: TradeSignal): PlainDecision {
  const buy = signal.action === "Buy Watch";
  const sell = signal.action === "Sell/Exit Watch";
  const headline = buy
    ? `Best buy-watch right now: ${signal.symbol}`
    : sell
      ? `Best sell/avoid-watch right now: ${signal.symbol}`
      : signal.dataFresh
        ? `No strong trade right now: ${signal.symbol}`
        : `No real-time stock call: ${signal.symbol} data is stale`;
  const plainAction = buy
    ? "This is the strongest thing to consider buying, but only if it fits your plan."
    : sell
      ? "This is the strongest thing to consider selling, avoiding, or protecting profits on."
      : signal.dataFresh
        ? "The app does not see a clean edge here right now."
        : "Do not treat this as a current buy or sell call. The latest quote is not fresh enough.";
  const simpleWhy = [
    signal.action !== "Hold/No Trade" ? "Several independent rules agree." : "The rules do not agree enough.",
    signal.confirmations.includes("Price above open") ? "It is trading better than where it started." : "It is not clearly stronger than its start.",
    signal.confirmations.includes("Close location strong") ? "It is near the stronger part of today's range." : "It is not sitting in a strong part of today's range.",
    signal.rewardRisk >= 1.5 ? "The possible reward is large enough compared with the risk." : "The reward compared with the risk is not ideal.",
  ];
  const simpleRisk = buy
    ? `If it drops near ${signal.invalidation}, the idea is wrong. Risk no more than ${signal.positionRiskPct}% on the idea.`
    : sell
      ? `If you own it, review protection near ${signal.invalidation}. If you do not own it, avoid chasing it.`
      : "Wait for a cleaner setup.";
  const simpleNextStep = buy
    ? "Check the news, write the reason in your journal, and only then decide."
    : sell
      ? "Check whether there is news causing the move, then protect or stand aside."
      : "Do nothing unless a better signal appears.";
  return { headline, symbol: signal.symbol, plainAction, simpleWhy, simpleRisk, simpleNextStep };
}

function formatPlainMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
