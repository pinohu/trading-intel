export type TrustPriority = "Critical" | "High" | "Medium";
export type TrustStatus = "Live" | "Partial" | "Blocked" | "Planned";

export type TrustOperationGap = {
  capability: string;
  issue: string;
  whyItMatters: string;
  priority: TrustPriority;
  status: TrustStatus;
  proofStatus: TrustStatus;
  evidenceStandard: string;
  currentState: string;
  nextAction: string;
  acceptanceCriteria: string[];
};

export const trustOperationGaps: TrustOperationGap[] = [
  {
    capability: "Licensed real-time market data",
    issue: "Free-first research feeds are live; execution-grade stock and futures coverage is still incomplete.",
    whyItMatters: "Public/free feeds reduce paid dependencies for research, but live trading decisions still need licensed, timestamped data with known entitlements.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Every live-capable signal must identify the feed, entitlement level, timestamp age, and whether the quote is research-only.",
    currentState: "Auto provider routing now tries public Nasdaq/CNBC/Yahoo/Binance/Stooq paths first; Alpaca/Polygon/Twelve Data are optional explicit or credentialed upgrades.",
    nextAction: "Keep paid SIP/futures data optional for research, and fail closed only when a trade is promoted as execution-grade.",
    acceptanceCriteria: [
      "Free-first quote paths are visible as research-only by default.",
      "SIP or equivalent stock feed is configured before stock signals are labeled execution grade.",
      "Licensed futures/commodity data is configured before futures-derived commodity trades are treated as execution grade.",
      "The UI marks public, unofficial, delayed, and stale feeds as research-only.",
    ],
  },
  {
    capability: "Durable outcome proof",
    issue: "The platform records outcomes, but needs enough samples across market regimes before promoting strategies as durable.",
    whyItMatters: "The core proof question is whether this exact signal survives slippage, fees, spreads, stale data, and different market conditions.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "A strategy needs live or paper outcomes at 5m, 15m, 1h, 1d, and multi-day horizons, plus slippage, fees, spreads, and cost-adjusted backtests across regimes.",
    currentState: "Signal snapshots and outcome checks are stored in SQL/AITable, the monitor evaluates 5m, 15m, 1h, and 1d follow-through, and the systematic-trading reference map now keeps data, alpha, analytics, backtest, live-control, architecture, tooling, and AI lanes visible.",
    nextAction: "Require minimum sample sizes, slippage/fee assumptions, regime labels, and full systematic-lane coverage before any strategy can be called proven.",
    acceptanceCriteria: [
      "At least 100 outcome checks exist for a strategy family before it can graduate from watch to proven.",
      "Backtests include slippage, fees, drawdown, and out-of-sample validation metadata.",
      "Results are grouped by market regime so one friendly tape cannot masquerade as durable edge.",
    ],
  },
  {
    capability: "Paper trading integration",
    issue: "Resolved proving lane; keep it as the default before live execution.",
    whyItMatters: "Before real money, the app should place simulated trades and track whether signals actually work.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "Every paper order should be tied to the ticket, broker mode, signal evidence, risk settings, and later outcome checks.",
    currentState: "Alpaca paper execution is wired through the broker rail, with SQL/AITable order mirrors and paper-trade storage.",
    nextAction: "Keep paper mode as the default proving lane before any live order is considered.",
    acceptanceCriteria: [
      "Paper order requests include trigger, stop, target, quantity, max loss, and acknowledgement state.",
      "Paper fills and saved plans are available for later outcome review.",
    ],
  },
  {
    capability: "Trade ticket workflow",
    issue: "Resolved action-plan lane; every surfaced trade has to become an auditable ticket.",
    whyItMatters: "Every buy/sell lead needs entry trigger, stop, target, position size, max loss, reason, and a do-not-trade checklist.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "No trade card can be actionable unless trigger, stop, target, reward/risk, position size, risk dollars, and blockers are present.",
    currentState: "The dashboard generates a trade ticket from the selected buy lead, live quote, and risk settings.",
    nextAction: "Keep broker placement downstream of the ticket so execution cannot bypass the plan.",
    acceptanceCriteria: [
      "Entry, stop, target, reward/risk, shares/contracts, notional, max loss, and blockers are visible.",
      "Manual live acknowledgement remains required before live orders.",
    ],
  },
  {
    capability: "Cost-aware historical backtesting",
    issue: "Core engine is live; deeper external compute and regime sweeps are still hardening work.",
    whyItMatters: "Strategies must be tested across symbols, regimes, slippage, spreads, fees, and drawdowns before trust.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "Backtests must disclose trade count, return, max drawdown, profit factor, slippage, fees, and out-of-sample validation.",
    currentState: "The Quant Lab can run Alpaca historical-bars backtests with slippage, fees, drawdown, validation metadata, SQL storage, and systematic taxonomy pressure for when to escalate to factor, vectorized, event-driven, or live-control proof.",
    nextAction: "Promote robust strategies into deeper Alphalens/vectorbt/RQAlpha/LEAN/StockSharp worker tests when the systematic map shows a proof lane is missing.",
    acceptanceCriteria: [
      "Historical runs store assumptions and validation metadata.",
      "Weak sample sizes and high drawdown remain visible blockers.",
    ],
  },
  {
    capability: "Portfolio and position tracking",
    issue: "Resolved exposure control; extend strategy-specific limits next.",
    whyItMatters: "The app should know existing exposure, daily P/L, max loss, and overlap risk before a new trade.",
    priority: "Critical",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "Every trade decision should see account value, cash, open positions, open orders, concentration, daily P/L, and risk flags.",
    currentState: "Alpaca account, positions, orders, exposure, concentration, daily P/L, and risk flags are synced and stored.",
    nextAction: "Add broker-specific risk limits per strategy and user role.",
    acceptanceCriteria: [
      "Risk flags appear before order placement.",
      "New tickets account for current exposure and max daily loss.",
    ],
  },
  {
    capability: "Persistent database",
    issue: "Resolved storage foundation; migrations and retention policies are the remaining operating work.",
    whyItMatters: "Signals, trades, outcomes, watchlists, alerts, and model performance need durable storage.",
    priority: "High",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "Trust data should survive refreshes and be queryable by signal, strategy, broker event, backtest, and outcome horizon.",
    currentState: "Neon Postgres is connected with tables for signals, trades, outcomes, alerts, backtests, risk snapshots, broker events, and validation reports.",
    nextAction: "Add migrations and retention policies as usage grows.",
    acceptanceCriteria: [
      "Schema readiness checks pass before durable proof features are marked ready.",
      "Audit, signal, outcome, and broker tables are present.",
    ],
  },
  {
    capability: "News and catalyst engine",
    issue: "Catalyst coverage is useful but not complete enough for full event-risk proof.",
    whyItMatters: "Signals need earnings, Fed events, SEC filings, EIA oil/gas inventories, USDA crop/weather events, and breaking headlines.",
    priority: "High",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "A signal should list known market-moving events and identify when catalyst coverage is only a proxy.",
    currentState: "Yahoo headlines run first by default; SEC filing routes, EIA/USDA event-risk references, static catalyst rules, and an optional StockSight sentiment worker lane are live.",
    nextAction: "Treat Benzinga/Finnhub/NewsAPI as optional paid enrichments, expand free official calendar metadata where public endpoints support it, and require StockSight-style sentiment to show source count, timestamps, polarity, subjectivity, and collection limits.",
    acceptanceCriteria: [
      "Earnings and macro calendars are visible beside affected symbols.",
      "Commodity alerts include inventory, weather, roll, and major report risk when applicable.",
    ],
  },
  {
    capability: "Alert delivery",
    issue: "Free browser alerts are live; optional off-device subscriptions still need configuration.",
    whyItMatters: "Users need alerts when a trigger is hit, stale data appears, or a stop/target is touched.",
    priority: "High",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Each alert path should show channel, subscription state, last delivery result, and whether it is browser-only or off-device.",
    currentState: "Browser notifications, in-dashboard monitor alerts, webhook/SMS/email adapters, SQL alert event storage, and an optional StreetMerchant-style alert-loop worker lane are implemented.",
    nextAction: "Use browser notifications as the free default, use StreetMerchant-style checks for loop/cooldown/channel proof, then add user-owned webhook or paid SMS/email only when off-device delivery is required.",
    acceptanceCriteria: [
      "Browser alerts can request permission and show armed/unarmed state without paid providers.",
      "Optional off-device channels can send a test alert and store delivery result.",
      "Users can see which alert channels are armed before relying on them.",
    ],
  },
  {
    capability: "Broker read-only sync",
    issue: "Resolved for Alpaca; non-Alpaca accounts are optional expansion.",
    whyItMatters: "Before execution, the app should pull real positions and balances read-only.",
    priority: "High",
    status: "Live",
    proofStatus: "Live",
    evidenceStandard: "Broker state should include account, positions, orders, activities, calendar, portfolio history, and reconciliation evidence.",
    currentState: "Alpaca account, positions, open orders, activities, calendar, and portfolio history are available in the broker panel.",
    nextAction: "Add optional read-only sync for any non-Alpaca broker accounts.",
    acceptanceCriteria: [
      "Read-only broker state is visible before order placement.",
      "Reconciliation can compare stored orders with broker state.",
    ],
  },
  {
    capability: "Model performance dashboard",
    issue: "Outcome summaries exist; per-strategy false-positive and regime dashboards need enough samples.",
    whyItMatters: "The app must show which signals made money, failed, win rate, average gain/loss, drawdown, and false positives.",
    priority: "High",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Performance should be grouped by strategy, horizon, symbol class, regime, signal quality, and action type.",
    currentState: "Signal snapshots are persisted, model-performance API summaries outcomes, the ops strip surfaces the best available proof count, and optional forecast workers now include explicit holdout/dependency-risk lanes.",
    nextAction: "Add per-strategy false-positive, drawdown, regime, and forecast-family dashboards once enough live samples accumulate.",
    acceptanceCriteria: [
      "Performance cannot show green unless outcome sample thresholds are met.",
      "False positives, average return, and drawdown are visible by strategy family.",
    ],
  },
  {
    capability: "Options and volatility data",
    issue: "Options context uses the free/indicative path when available and depends on provider permissions for OPRA-grade proof.",
    whyItMatters: "Options flow, implied volatility, put/call activity, and unusual volume improve stock context.",
    priority: "Medium",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Options-derived context should disclose provider, snapshot age, contract selection, and whether IV/history is missing.",
    currentState: "Alpaca option contracts, option snapshots, and a contract-selection workflow are available when permissions allow.",
    nextAction: "Keep contract-only/indicative output labeled partial, and add paid OPRA/options-flow only when execution-grade options context is required.",
    acceptanceCriteria: [
      "Options context is blocked or labeled partial when provider permissions are missing.",
      "Unusual activity and IV history are not inferred from incomplete data.",
    ],
  },
  {
    capability: "Commodity coverage",
    issue: "Free commodity proxies are live, but professional futures proof still needs licensed data and roll logic.",
    whyItMatters: "A serious commodities system needs licensed futures data, roll handling, contract calendars, spreads, and inventory/weather calendars.",
    priority: "High",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Commodity signals should identify ETF/proxy/futures source, contract month, roll risk, spread context, and inventory/weather events.",
    currentState: "Commodity ETFs, public futures aliases, and EIA/USDA event-risk references exist, with explicit unofficial/proxy labels.",
    nextAction: "Use ETF/public aliases for research, and add CME-licensed futures data, contract metadata, roll rules, and spread monitoring only for execution-grade futures.",
    acceptanceCriteria: [
      "Futures-derived signals show contract and roll context.",
      "ETF proxies stay marked as proxies and never as direct futures proof.",
    ],
  },
  {
    capability: "Security hardening",
    issue: "Baseline controls exist; production user roles and secret rotation are still open.",
    whyItMatters: "Strong auth, rate limits, audit logs, secret rotation, and separate admin/user views are required for real use.",
    priority: "High",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Sensitive operations should be authenticated, authorized, rate-limited, audited, and separated by role.",
    currentState: "Private access code gate, rate limits, SQL audit events, security headers, and live-order acknowledgement gates exist.",
    nextAction: "Add a proper auth provider, role-based access, and secret rotation workflow.",
    acceptanceCriteria: [
      "Admin and trading operations have role checks.",
      "Secrets can rotate without code changes or dashboard downtime.",
    ],
  },
  {
    capability: "Mobile PWA polish",
    issue: "The app is installable, but push and offline behavior need product polish.",
    whyItMatters: "The phone app should support installability, saved views, background refresh hints, and lock-screen style alerts.",
    priority: "Medium",
    status: "Live",
    proofStatus: "Partial",
    evidenceStandard: "Mobile should preserve readability, target sizes, installability, and clear alert capability state.",
    currentState: "Manifest, app icons, responsive dashboard, high-contrast tokens, and fast mobile ticker are present.",
    nextAction: "Add a service worker and richer push-alert subscription management.",
    acceptanceCriteria: [
      "Installability checks pass on mobile browsers.",
      "Push subscription state is explicit and reversible.",
    ],
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
    description: "Track simulated trades first; keep paper mode as the proving lane before any live order.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Signal Outcome Tracker",
    description: "Store every signal and check what happened 5m, 15m, 1h, 1d, and later.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Backtest Engine",
    description: "Run cost-aware historical tests before trusting any strategy.",
    status: "Live" as TrustStatus,
  },
  {
    name: "Free-First Data Path",
    description: "Use public/free feeds by default; add paid/credentialed feeds only when execution-grade proof needs them.",
    status: "Partial" as TrustStatus,
  },
  {
    name: "Durable Proof Gate",
    description: "Require sample-size, slippage, fee, and regime evidence before calling a strategy proven.",
    status: "Partial" as TrustStatus,
  },
];

export function unresolvedTrustGaps(gaps = trustOperationGaps) {
  return gaps.filter((gap) => gap.proofStatus !== "Live");
}

export function criticalUnresolvedTrustGaps(gaps = trustOperationGaps) {
  return unresolvedTrustGaps(gaps).filter((gap) => gap.priority === "Critical");
}

export function sortedTrustGaps(gaps = trustOperationGaps) {
  return [...gaps].sort((a, b) => statusRank(a.proofStatus) - statusRank(b.proofStatus) || priorityRank(a.priority) - priorityRank(b.priority) || a.capability.localeCompare(b.capability));
}

export function trustSummary(gaps = trustOperationGaps) {
  const unresolved = unresolvedTrustGaps(gaps);
  const criticalUnresolved = criticalUnresolvedTrustGaps(gaps);
  const live = gaps.filter((gap) => gap.status === "Live").length;
  const proven = gaps.filter((gap) => gap.proofStatus === "Live").length;
  const partial = gaps.filter((gap) => gap.proofStatus === "Partial").length;
  const blocked = gaps.filter((gap) => gap.proofStatus === "Blocked").length;
  const planned = gaps.filter((gap) => gap.proofStatus === "Planned").length;
  const proofCoveragePct = gaps.length === 0 ? 0 : Math.round(((proven + partial * 0.5) / gaps.length) * 100);

  return {
    total: gaps.length,
    critical: gaps.filter((gap) => gap.priority === "Critical").length,
    live,
    partial,
    blocked,
    planned,
    proven,
    resolved: proven,
    unresolved: unresolved.length,
    criticalUnresolved: criticalUnresolved.length,
    proofCoveragePct,
  };
}

function statusRank(status: TrustStatus) {
  if (status === "Blocked") return 0;
  if (status === "Planned") return 1;
  if (status === "Partial") return 2;
  return 3;
}

function priorityRank(priority: TrustPriority) {
  if (priority === "Critical") return 0;
  if (priority === "High") return 1;
  return 2;
}
