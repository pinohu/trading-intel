export type TrustPriority = "Critical" | "High" | "Medium";
export type TrustStatus = "Live" | "Partial" | "Blocked" | "Planned";

export type TrustOperationGap = {
  missingPiece: string;
  whyItMatters: string;
  priority: TrustPriority;
  status: TrustStatus;
  currentState: string;
  nextAction: string;
};

export const trustOperationGaps: TrustOperationGap[] = [
  {
    missingPiece: "Licensed real-time market data",
    whyItMatters: "Public/free feeds are useful, but not execution-grade. Stocks need SIP/paid coverage; futures and commodities need licensed futures data.",
    priority: "Critical",
    status: "Partial",
    currentState: "Public Nasdaq/CNBC/Yahoo/Binance/Stooq feeds are labeled and freshness-gated.",
    nextAction: "Add SIP stock feed credentials and a licensed futures data provider when available.",
  },
  {
    missingPiece: "Paper trading integration",
    whyItMatters: "Before real money, the app should place simulated trades and track whether signals actually work.",
    priority: "Critical",
    status: "Live",
    currentState: "Alpaca paper execution is wired through the broker rail, with SQL/AITable order mirrors and paper-trade storage.",
    nextAction: "Keep paper mode as the default proving lane before any live order is considered.",
  },
  {
    missingPiece: "Trade ticket workflow",
    whyItMatters: "Every buy/sell lead needs entry trigger, stop, target, position size, max loss, reason, and a do-not-trade checklist.",
    priority: "Critical",
    status: "Live",
    currentState: "The dashboard generates a trade ticket from the selected buy lead and risk settings.",
    nextAction: "Attach broker paper-order placement after account credentials are configured.",
  },
  {
    missingPiece: "Real historical backtesting",
    whyItMatters: "Strategies must be tested across symbols, regimes, slippage, spreads, and fees before trust.",
    priority: "Critical",
    status: "Live",
    currentState: "The Quant Lab can now run a real Alpaca historical-bars backtest with slippage, fees, drawdown, and SQL storage.",
    nextAction: "Promote robust strategies into deeper vectorbt/LEAN worker tests when external compute is added.",
  },
  {
    missingPiece: "Portfolio and position tracking",
    whyItMatters: "The app should know existing exposure, daily P/L, max loss, and overlap risk before a new trade.",
    priority: "Critical",
    status: "Live",
    currentState: "Alpaca account, positions, orders, exposure, concentration, daily P/L, and risk flags are synced and stored.",
    nextAction: "Add broker-specific risk limits per strategy and user role.",
  },
  {
    missingPiece: "Persistent database",
    whyItMatters: "Signals, trades, outcomes, watchlists, alerts, and model performance need durable storage.",
    priority: "High",
    status: "Live",
    currentState: "Neon Postgres is connected with tables for signals, trades, outcomes, alerts, backtests, risk snapshots, and broker events.",
    nextAction: "Add migrations and retention policies as usage grows.",
  },
  {
    missingPiece: "News/catalyst engine",
    whyItMatters: "Signals need earnings, Fed events, SEC filings, EIA oil/gas inventories, USDA crop/weather events, and breaking headlines.",
    priority: "High",
    status: "Partial",
    currentState: "Yahoo headlines and static event-risk rules exist.",
    nextAction: "Add SEC EDGAR, earnings calendar, EIA/USDA calendars, and paid news when keys exist.",
  },
  {
    missingPiece: "Alert delivery",
    whyItMatters: "Users need alerts when a trigger is hit, stale data appears, or a stop/target is touched.",
    priority: "High",
    status: "Partial",
    currentState: "Browser notifications, webhook/SMS/email adapters, and SQL alert event storage are implemented.",
    nextAction: "Configure Twilio/Resend/webhook keys and persist alert subscriptions.",
  },
  {
    missingPiece: "Broker read-only sync",
    whyItMatters: "Before execution, the app should pull real positions and balances read-only.",
    priority: "High",
    status: "Live",
    currentState: "Alpaca account, positions, open orders, activities, calendar, and portfolio history are available in the broker panel.",
    nextAction: "Add optional read-only sync for any non-Alpaca broker accounts.",
  },
  {
    missingPiece: "Model performance dashboard",
    whyItMatters: "The app must show which signals made money, failed, win rate, average gain/loss, drawdown, and false positives.",
    priority: "High",
    status: "Live",
    currentState: "Signal snapshots are persisted and the monitor evaluates 5m, 15m, 1h, and 1d outcomes into SQL/AITable.",
    nextAction: "Add per-strategy false-positive dashboards once enough live samples accumulate.",
  },
  {
    missingPiece: "Options and volatility data",
    whyItMatters: "Options flow, implied volatility, put/call activity, and unusual volume improve stock context.",
    priority: "Medium",
    status: "Partial",
    currentState: "Alpaca option contracts, option snapshots, and a contract-selection workflow are available when permissions allow.",
    nextAction: "Add paid options-flow and implied-volatility history when credentials exist.",
  },
  {
    missingPiece: "Better commodity coverage",
    whyItMatters: "A serious commodities system needs licensed futures data, roll handling, contract calendars, spreads, and inventory/weather calendars.",
    priority: "High",
    status: "Partial",
    currentState: "Commodity ETFs and public futures aliases exist, with explicit unofficial labels.",
    nextAction: "Add CME-licensed futures data, contract metadata, roll rules, and spread monitoring.",
  },
  {
    missingPiece: "Security hardening",
    whyItMatters: "Strong auth, rate limits, audit logs, secret rotation, and separate admin/user views are required for real use.",
    priority: "High",
    status: "Partial",
    currentState: "Private access code gate, rate limits, SQL audit events, security headers, and live-order acknowledgement gates exist.",
    nextAction: "Add a proper auth provider, role-based access, and secret rotation workflow.",
  },
  {
    missingPiece: "Mobile PWA polish",
    whyItMatters: "The phone app should support installability, saved views, background refresh hints, and lock-screen style alerts.",
    priority: "Medium",
    status: "Partial",
    currentState: "Manifest, app icons, responsive dashboard, and fast mobile ticker are present.",
    nextAction: "Add a service worker and richer push-alert subscription management.",
  },
];

export const trustBuildOrder = [
  {
    name: "Trade Ticket",
    description: "Turn every lead into a clear action plan: entry, stop, target, shares/contracts, and max loss.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Paper Trading",
    description: "Track simulated trades first, then connect Alpaca paper trading once keys are available.",
    status: "Partial" as TrustStatus,
  },
  {
    name: "Signal Outcome Tracker",
    description: "Store every signal and check what happened 5m, 15m, 1h, and 1d later.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Backtest Engine",
    description: "Add historical tests before trusting any strategy.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Licensed Data Path",
    description: "Add paid/credentialed feeds when ready; public feeds remain research-only.",
    status: "Partial" as TrustStatus,
  },
];

export function trustSummary() {
  return {
    total: trustOperationGaps.length,
    critical: trustOperationGaps.filter((gap) => gap.priority === "Critical").length,
    live: trustOperationGaps.filter((gap) => gap.status === "Live").length,
    partial: trustOperationGaps.filter((gap) => gap.status === "Partial").length,
    blocked: trustOperationGaps.filter((gap) => gap.status === "Blocked").length,
    planned: trustOperationGaps.filter((gap) => gap.status === "Planned").length,
  };
}
