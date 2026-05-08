import { buildBuyTradeTicket, type TradeTicket } from "@/lib/tradeTicket";
import { generateBuyLeads, type BuyLead, type SignalQuote } from "@/lib/signalEngine";
import type { TradingMindConsensus } from "@/lib/tradingMinds";

export type BuyNowSignal = {
  symbol: string;
  name: string;
  rank: number;
  action: "Buy Now Candidate";
  price: number;
  trigger: number;
  entry: number;
  entrySignalNeeded: string;
  stop: number;
  target: number;
  units: number;
  maxLoss: number;
  rewardRisk: number;
  riskRewardRatio: number;
  potentialUnits: number;
  potentialNotional: number;
  positionSize: string;
  suggestedPositionSize: string;
  holdingPeriod: TradeTicket["holdingPeriod"];
  expectedHold: string;
  maxHold: string;
  reviewCadence: string;
  confidence: number;
  dataQuality: SignalQuote["quality"];
  source: string;
  updatedAt: string;
  marketStatus?: string;
  reasons: string[];
  warnings: string[];
  strategyMindset: TradingMindConsensus;
  ticket: TradeTicket;
  generatedAt: string;
};

export type BlockedBuyNowSignal = {
  symbol: string;
  name: string;
  rank: number;
  price: number;
  trigger: number;
  entrySignalNeeded: string;
  stop: number;
  target: number;
  confidence: number;
  rewardRisk: number;
  potentialUnits: number;
  potentialNotional: number;
  positionSize: string;
  suggestedPositionSize: string;
  holdingPeriod: TradeTicket["holdingPeriod"];
  expectedHold: string;
  dataQuality: SignalQuote["quality"];
  blockers: string[];
  reasons: string[];
  strategyMindset: TradingMindConsensus;
};

export type BuyNowResult = {
  generatedAt: string;
  buyNow: BuyNowSignal[];
  blocked: BlockedBuyNowSignal[];
  strictRules: string[];
};

const defaultStrictRules = [
  "The quote must be fresh.",
  "The setup must already be an active buy watch, not only a future trigger.",
  "Current price must be at or above the trigger.",
  "Confidence must be 70 or higher.",
  "Reward/risk must be at least 1.5R.",
  "Position sizing must produce at least one unit inside the configured risk limit.",
];

export function generateBuyNowSignals({
  quotes,
  accountSize,
  riskPct,
  maxDailyLossPct,
  minConfidence = 70,
}: {
  quotes: SignalQuote[];
  accountSize: number;
  riskPct: number;
  maxDailyLossPct: number;
  minConfidence?: number;
}): BuyNowResult {
  const generatedAt = new Date().toISOString();
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const leads = generateBuyLeads(quotes, riskPct);
  const promoted: BuyNowSignal[] = [];
  const blocked: BlockedBuyNowSignal[] = [];

  leads.forEach((lead, index) => {
    const quote = quoteBySymbol.get(lead.symbol);
    if (!quote) return;

    const ticket = buildBuyTradeTicket({
      lead,
      accountSize,
      riskPct,
      maxDailyLossPct,
    });
    const blockers = buyNowBlockers({ lead, ticket, minConfidence });

    if (blockers.length === 0) {
      promoted.push({
        symbol: lead.symbol,
        name: lead.name,
        rank: promoted.length + 1,
        action: "Buy Now Candidate",
        price: lead.price,
        trigger: ticket.trigger,
        entry: ticket.entry,
        entrySignalNeeded: ticket.entrySignalNeeded,
        stop: ticket.stop,
        target: ticket.target,
        units: ticket.units,
        maxLoss: ticket.maxLoss,
        rewardRisk: ticket.rewardRisk,
        riskRewardRatio: ticket.riskRewardRatio,
        potentialUnits: ticket.potentialUnits,
        potentialNotional: ticket.potentialNotional,
        positionSize: ticket.positionSize,
        suggestedPositionSize: ticket.suggestedPositionSize,
        holdingPeriod: ticket.holdingPeriod,
        expectedHold: ticket.expectedHold,
        maxHold: ticket.maxHold,
        reviewCadence: ticket.reviewCadence,
        confidence: lead.confidence,
        dataQuality: quote.quality,
        source: quote.source,
        updatedAt: quote.updatedAt,
        marketStatus: lead.marketStatus,
        reasons: [
          "The live price has reached the entry trigger.",
          ...lead.simpleWhy.filter((reason) => !reason.toLowerCase().includes("needs to prove")).slice(0, 3),
          `The planned loss is capped near ${money(ticket.maxLoss)} before any trade is considered.`,
        ],
        warnings: lead.warnings,
        strategyMindset: lead.strategyMindset,
        ticket,
        generatedAt,
      });
      return;
    }

    blocked.push({
      symbol: lead.symbol,
      name: lead.name,
      rank: index + 1,
      price: lead.price,
      trigger: lead.trigger,
      entrySignalNeeded: ticket.entrySignalNeeded,
      stop: ticket.stop,
      target: ticket.target,
      confidence: lead.confidence,
      rewardRisk: lead.rewardRisk,
      potentialUnits: ticket.potentialUnits,
      potentialNotional: ticket.potentialNotional,
      positionSize: ticket.positionSize,
      suggestedPositionSize: ticket.suggestedPositionSize,
      holdingPeriod: lead.holdingPeriod.label,
      expectedHold: lead.holdingPeriod.expectedHold,
      dataQuality: quote.quality,
      blockers,
      reasons: lead.simpleWhy.slice(0, 2),
      strategyMindset: lead.strategyMindset,
    });
  });

  return {
    generatedAt,
    buyNow: promoted.sort((a, b) => b.confidence - a.confidence || b.rewardRisk - a.rewardRisk).slice(0, 6),
    blocked: blocked
      .sort((a, b) => {
        const statusDelta = a.blockers.length - b.blockers.length;
        return statusDelta || b.confidence - a.confidence || b.rewardRisk - a.rewardRisk;
      })
      .slice(0, 8),
    strictRules: defaultStrictRules,
  };
}

function buyNowBlockers({
  lead,
  ticket,
  minConfidence,
}: {
  lead: BuyLead;
  ticket: TradeTicket;
  minConfidence: number;
}) {
  return [
    !lead.dataFresh ? "Quote is stale." : "",
    lead.status !== "Buy Watch"
      ? lead.status === "Buy Lead - Wait for Trigger"
        ? `It has not reached the trigger yet. Needs ${money(lead.trigger)}.`
        : "The current rule stack does not allow a buy."
      : "",
    lead.price + 0.005 < lead.trigger ? `Current price is still below the trigger at ${money(lead.trigger)}.` : "",
    lead.confidence < minConfidence ? `Confidence is ${lead.confidence}; buy-now requires ${minConfidence} or higher.` : "",
    lead.rewardRisk < 1.5 ? `Reward/risk is ${lead.rewardRisk}R; buy-now requires at least 1.5R.` : "",
    !ticket.tradeable ? "Position sizing or risk controls blocked the trade ticket." : "",
    ticket.units < 1 ? "Configured account/risk size is too small for one unit." : "",
    lead.warnings.find((warning) => /outside|wait for cleaner|stale|sell\/exit/i.test(warning)) ?? "",
  ].filter(Boolean);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
