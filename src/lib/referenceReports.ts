export type ReferenceReportLesson = {
  key: string;
  title: string;
  source: string;
  lesson: string;
  systemRule: string;
  category: "data" | "risk" | "execution" | "research" | "operations" | "security";
};

export const minimumReferenceRewardRisk = 1.5;

export const referenceReportLessons: ReferenceReportLesson[] = [
  {
    key: "architecture",
    title: "Architecture",
    source: "docs/ARCHITECTURE.md",
    lesson: "The dashboard is a research and guarded broker-operations cockpit, not an autonomous live-trading system.",
    systemRule: "Every promoted idea must keep data, ticket, proof, broker, and audit boundaries visible.",
    category: "operations",
  },
  {
    key: "production-trading-ops",
    title: "Production Trading Operations",
    source: "docs/PRODUCTION_TRADING_OPS.md",
    lesson: "Live orders require broker credentials, live acknowledgement, audit storage, pre-trade controls, and kill-switch clearance.",
    systemRule: "Live mode stays manual and gated even when paper execution is ready.",
    category: "execution",
  },
  {
    key: "broker-execution",
    title: "Broker Execution",
    source: "docs/BROKER_EXECUTION.md",
    lesson: "The broker rail allows authenticated day limit orders only, with whole-share stock/ETF constraints and live acknowledgement.",
    systemRule: "Trade tickets must expose entry, stop, target, quantity, notional, max loss, and live gate state before submission.",
    category: "execution",
  },
  {
    key: "agent-trading",
    title: "Agent Trading",
    source: "docs/AGENT_TRADING.md",
    lesson: "Agents may draft or paper-submit orders, but live-money autonomy remains blocked.",
    systemRule: "Agent output is an input to the visible ticket and manual live broker rail, not a hidden executor.",
    category: "execution",
  },
  {
    key: "data-policy",
    title: "Market Data Policy",
    source: "docs/DATA_POLICY.md",
    lesson: "Production must never invent market data; stale or public-only feeds should not be treated as execution-grade proof.",
    systemRule: "Buy-now promotion requires fresh data and quality labels; unavailable data blocks action.",
    category: "data",
  },
  {
    key: "research-stack",
    title: "Research Stack",
    source: "docs/RESEARCH_STACK.md",
    lesson: "Use credentialed providers first, public fallbacks second, native engines for bounded tasks, and external workers for heavy research.",
    systemRule: "Fusion scoring should show which lanes are active, proxy, missing, or blocked.",
    category: "research",
  },
  {
    key: "algorithm-council",
    title: "Algorithm Council",
    source: "docs/ALGORITHM_COUNCIL.md",
    lesson: "Fundamentals, quality, value, momentum, accounting risk, and data coverage improve signal quality but still need proof gates.",
    systemRule: "Factor evidence can support a thesis, but trade promotion still needs a ticket, backtest, paper outcomes, and risk controls.",
    category: "research",
  },
  {
    key: "institutional-gates",
    title: "Institutional Gates",
    source: "docs/INSTITUTIONAL_GATES.md",
    lesson: "Proof, controls, worker readiness, broker reconciliation, and compliance boundaries convert signals into operations.",
    systemRule: "Control-plane runs must include stage evidence and block execution when risk review fails.",
    category: "operations",
  },
  {
    key: "autoresearch-lab",
    title: "AutoResearch Lab",
    source: "docs/AUTORESEARCH_LAB.md",
    lesson: "Automated experiments are research-only until out-of-sample proof, paper trading, costs, ticket shape, and human review agree.",
    systemRule: "Autoresearch results can strengthen confidence, but cannot bypass paper/live gates.",
    category: "research",
  },
  {
    key: "ising-optimizer",
    title: "Ising Basket Optimizer",
    source: "docs/ISING_OPTIMIZER.md",
    lesson: "The optimizer selects among existing candidates under budget, risk, max-position, and overlap limits; it does not predict price.",
    systemRule: "Basket selection must inherit freshness, ticket, risk, and tradeability constraints from each candidate.",
    category: "risk",
  },
  {
    key: "runbook",
    title: "Production Runbook",
    source: "docs/RUNBOOK.md",
    lesson: "Health, persistence, broker, market-data, auth, cron, and TradingAgents checks are operational prerequisites.",
    systemRule: "Operational readiness should remain visible next to trade decisions.",
    category: "operations",
  },
  {
    key: "security",
    title: "Security Model",
    source: "docs/SECURITY.md",
    lesson: "Private access, rate limits, session cookies, query guards, cron secrets, and audit events are required before broker operations.",
    systemRule: "Broker routes stay user-session-only and never fail open.",
    category: "security",
  },
  {
    key: "ai-trader",
    title: "AI-Trader Reference",
    source: "external-repos/AI-Trader/README.md",
    lesson: "Agent-native trading systems benefit from collective signal pressure and paper/live separation.",
    systemRule: "Agent consensus should raise or lower confidence, not replace ticket-level risk approval.",
    category: "research",
  },
  {
    key: "vibe-trading",
    title: "Vibe-Trading Reference",
    source: "external-repos/Vibe-Trading/README.md",
    lesson: "Multi-agent strategy work should turn natural-language ideas into testable strategies, journals, backtests, and exportable reports.",
    systemRule: "The cockpit should present plain-language entry requirements plus quantified stop, target, and sizing.",
    category: "research",
  },
  {
    key: "fincept-terminal",
    title: "Fincept Terminal Reference",
    source: "external-repos/FinceptTerminal/README.md",
    lesson: "Professional finance terminals combine analytics, data connectors, portfolio risk, news, agents, and visual workflows.",
    systemRule: "Live presentation should make data, portfolio exposure, catalyst context, and order lifecycle state scannable.",
    category: "operations",
  },
  {
    key: "kronos",
    title: "Kronos Reference",
    source: "external-repos/Kronos/README.md",
    lesson: "Market-model forecasts need task-specific data handling and should be treated as research evidence, not guaranteed signals.",
    systemRule: "Forecast-like evidence should be weighted behind freshness, validation, and risk controls.",
    category: "research",
  },
];

export function referenceReportSummary() {
  const categories = referenceReportLessons.reduce<Record<ReferenceReportLesson["category"], number>>(
    (counts, lesson) => {
      counts[lesson.category] += 1;
      return counts;
    },
    { data: 0, risk: 0, execution: 0, research: 0, operations: 0, security: 0 },
  );
  return {
    total: referenceReportLessons.length,
    categories,
    appliedRules: referenceReportLessons.map((lesson) => lesson.systemRule),
  };
}

export function executionReferenceChecklist() {
  return [
    `Reward/risk must be at least ${minimumReferenceRewardRisk}R before buy-now promotion.`,
    "Entry trigger, stop, target, unit size, notional size, max loss, and entry signal must be visible.",
    "Live execution requires manual broker approval, acknowledgement, audit storage, and pre-trade controls.",
    "Public or stale market data blocks live-quality promotion.",
    "Agent, optimizer, and forecast evidence cannot bypass the ticket or risk reviewer.",
  ];
}
