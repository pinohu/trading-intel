"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  Bot,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Database,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers,
  LineChart,
  ListOrdered,
  MessageSquare,
  Newspaper,
  Plus,
  RefreshCcw,
  Send,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { engineCapabilities, engineWorkflow, type EngineCapability } from "@/lib/engineCatalog";
import { buildFusionAlphaPredictions, type FusionEngineFinding, type FusionPrediction } from "@/lib/fusionAlpha";
import { generateBuyLeads, generateSignals, scoreQuote, type BuyLead, type TradeSignal } from "@/lib/signalEngine";
import { dayTradingBestPractices, dayTradingRules } from "@/lib/dayTradingPlaybook";
import { calculatePositionSize } from "@/lib/positionSizing";
import { marketEvents } from "@/lib/events";
import { criticalUnresolvedTrustGaps, sortedTrustGaps, trustBuildOrder, trustOperationGaps, trustSummary, type TrustOperationGap, type TrustPriority, type TrustStatus } from "@/lib/trustOperations";
import { buildBuyTradeTicket, type TradeTicket } from "@/lib/tradeTicket";
import { generateBuyNowSignals, type BlockedBuyNowSignal, type BuyNowSignal } from "@/lib/buyNowEngine";
import { optimizeTradeBasketFromLeads, type IsingBasketResult } from "@/lib/isingOptimizer";
import type { OrchestrationRun } from "@/lib/orchestration";
import { referenceReportLessons, referenceReportSummary } from "@/lib/referenceReports";
import type { TradingAssistantDashboardContext } from "@/lib/tradingAssistant";

const PriceChart = dynamic(() => import("@/components/PriceChart"), {
  ssr: false,
  loading: () => <div className="h-full rounded-md border border-white/10 bg-black/20" />,
});

type SparkPoint = {
  label: string;
  value: number;
};

const QuoteHistoryContext = createContext<Record<string, SparkPoint[]>>({});

type Quote = {
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
  quality: "Execution Grade" | "Public Real-Time" | "Partial Market" | "Unofficial" | "Delayed" | "Offline";
  updatedAt: string;
  marketStatus?: string;
};

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  symbol: string;
};

type JournalEntry = {
  id: string;
  symbol: string;
  setup: string;
  thesis: string;
  invalidation: string;
  confidence: number;
  risk: number;
  createdAt: string;
};

type PaperTrade = {
  id: string;
  symbol: string;
  side: "Buy" | "Sell / Avoid";
  entry: number;
  stop: number;
  target: number;
  units: number;
  maxLoss: number;
  status: "Watching" | "Closed" | "Canceled";
  createdAt: string;
};

type BrokerStatus = {
  ok: boolean;
  provider: "alpaca";
  mode: "paper" | "live";
  executionEnabled: boolean;
  credentialsConfigured: boolean;
  liveTradingEnabled: boolean;
  liveAckConfigured: boolean;
  orderPlacementReady: boolean;
  maxOrderNotional: number;
  maxOrderUnits: number;
  allowExtendedHours: boolean;
  dataQuality?: string;
  missing: string[];
  restrictions: string[];
  database: {
    configured: boolean;
    reachable: boolean;
    schemaReady: boolean;
  };
};

type BrokerMode = "paper" | "live";

type BrokerOverview = {
  ok: boolean;
  mode: BrokerMode;
  readiness: BrokerStatus;
  account: Record<string, unknown> | null;
  positions: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  portfolioHistory: Record<string, unknown> | null;
  activities: Array<Record<string, unknown>>;
  clock: Record<string, unknown> | null;
  calendar: Array<Record<string, unknown>>;
  errors?: Record<string, string | null>;
};

type AitableStatus = {
  ok: boolean;
  enabled: boolean;
  apiKeyConfigured: boolean;
  spaceIdConfigured: boolean;
  mirrorReady: boolean;
  spacesReachable: boolean;
  missing: string[];
};

type OpsStatus = {
  ok: boolean;
  productionReadyCore: boolean;
  capabilities: Array<{ key: string; label: string; ready: boolean; required: boolean }>;
  remainingLimits: string[];
  liveData?: {
    alpacaConfigured: boolean;
    alpacaDataQuality: string;
    licensedSip: boolean;
    publicFallbacks: boolean;
  };
  alerts?: Record<string, boolean>;
};

type RiskApiResponse = {
  ok: boolean;
  report?: {
    equity: number | null;
    dailyPnl: number | null;
    dailyPnlPct: number | null;
    grossExposure: number;
    netExposure: number;
    openOrdersNotional: number;
    concentration: Array<{ symbol: string; pctOfEquity: number; marketValue: number; unrealizedPnl: number }>;
    riskFlags: string[];
  };
  error?: string;
};

type ModelPerformanceApi = {
  ok: boolean;
  summary?: {
    total_signals?: number;
    buy_watch_signals?: number;
    sell_watch_signals?: number;
    fresh_signals?: number;
    avg_confidence?: number | null;
    avg_reward_risk?: number | null;
  };
  outcomes?: Array<{
    horizon: string;
    count: number;
    avg_return_pct: number | null;
    hit_targets: number;
    hit_stops: number;
    positive_outcomes?: number;
  }>;
  recentBacktests?: Array<Record<string, unknown>>;
  error?: string;
};

type BacktestApiResponse = {
  ok: boolean;
  metrics?: {
    symbolsTested: number;
    trades: number;
    winRate: number;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
  };
  results?: Array<{
    symbol: string;
    bars: number;
    trades: number;
    winRate: number;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
    status: "ok" | "insufficient-data" | "unsupported";
    validation?: Record<string, unknown> | null;
  }>;
  advisory?: string;
  error?: string;
};

type AlgorithmCouncilScore = {
  symbol: string;
  name: string;
  sector: string;
  recommendation: "Strong Buy Watch" | "Buy Watch" | "Hold/No Trade" | "Avoid / Sell Watch";
  ensembleScore: number;
  confidence: number;
  dataCoveragePct: number;
  modelVersion: string;
  factorScores: Array<{ name: string; score: number; weight: number; rationale: string[] }>;
  thesis: string;
  bearCase: string;
  plainAction: string;
  riskControls: string[];
  sources: string[];
  generatedAt: string;
};

type AlgorithmCouncilResponse = {
  ok: boolean;
  generatedAt?: string;
  degraded?: boolean;
  algorithms?: Array<{ key: string; name: string; purpose: string }>;
  scores?: AlgorithmCouncilScore[];
  advisory?: string;
  error?: string;
};

type InstitutionalReadinessApi = {
  ok: boolean;
  productionInstitutionalReady: boolean;
  missing?: string[];
  proof?: {
    grade: "green" | "amber" | "red";
    summary: { passed: number; partial: number; failed: number };
    gates: Array<{ key: string; label: string; status: "pass" | "partial" | "fail"; evidence: string; fix: string }>;
  };
  controls?: {
    killSwitch: boolean;
    allowPaperOrders: boolean;
    allowLiveOrders: boolean;
    maxOpenOrders: number;
    maxOpenOrdersPerSymbol: number;
    maxDailySubmittedNotional: number;
  };
  workers?: {
    grade: "ready" | "partial" | "missing";
    components: Array<{ key: string; label: string; ready: boolean; detail: string }>;
  };
  compliance?: {
    grade: "research-only" | "needs-review" | "blocked";
    controls: Array<{ key: string; label: string; ready: boolean; detail: string }>;
  };
};

type ResearchStackApi = {
  ok: boolean;
  grade: "production-path" | "research-ready" | "partial";
  configured: number;
  total: number;
  criticalConfigured: number;
  criticalTotal: number;
  components: Array<{
    key: string;
    label: string;
    category: string;
    ready: boolean;
    mode: "credentialed" | "free-fallback" | "worker" | "native" | "missing";
    detail: string;
    freeAlternative?: string;
    env: string[];
  }>;
  workerCommands: Array<{ name: string; purpose: string; command: string; urlEnv: string }>;
  missingExternalEntitlements: string[];
};

type AutoResearchApi = {
  ok: boolean;
  candidates?: Array<{ id: string; name: string; hypothesis: string }>;
  recentRuns?: Array<Record<string, unknown>>;
  guardrail?: string;
  runLabel?: string;
  champion?: {
    candidate: { id: string; name: string; hypothesis: string };
    score: number;
    verdict: string;
    metrics: BacktestApiResponse["metrics"];
    risks: string[];
  } | null;
  experiments?: Array<{
    candidate: { id: string; name: string; hypothesis: string };
    score: number;
    verdict: string;
    metrics: BacktestApiResponse["metrics"];
    risks: string[];
  }>;
  advisory?: string;
  error?: string;
};

type TradingAgentsApi = {
  ok: boolean;
  source?: "native-codebase-debate" | string;
  requested?: {
    symbols: string[];
    analysisDate: string;
    depth: "fast" | "standard" | "deep";
  };
  decisions?: Array<{
    symbol: string;
    rating: string;
    action: string;
    holdingPeriod: string;
    expectedHold: string;
    maxHold: string;
    reviewCadence: string;
    exitRule: string;
    evidenceGrade: string;
    evidenceSummary: string[];
    summary: string;
    thesis: string;
    risks: string[];
    portfolioDecision: string;
  }>;
  persistedNotes?: Array<Record<string, unknown>>;
  advisory?: string;
  error?: string;
};

type FusionAlphaApi = {
  ok: boolean;
  source?: "fusion-alpha-v1" | string;
  modelVersion?: string;
  generatedAt?: string;
  mode?: BrokerMode;
  provider?: string;
  lookbackDays?: number;
  predictions?: FusionPrediction[];
  advisory?: string;
  error?: string;
};

type AgentTraderApi = {
  ok: boolean;
  mode: BrokerMode;
  policy?: {
    enabled: boolean;
    paperAutomationEnabled: boolean;
    paperAutomationReady: boolean;
    liveAutonomyAllowed: false;
    liveRequiresManualApproval: true;
    minConfidence: number;
    maxProposals: number;
    maxPaperOrdersPerRun: number;
    missing: string[];
    restrictions: string[];
  };
  proposals?: Array<{
    id: string;
    symbol: string;
    mode: BrokerMode;
    status: "paper-ready" | "approval-required" | "blocked";
    confidence: number;
    orderDraft: {
      symbol: string;
      side: "buy" | "sell";
      qty: number;
      limitPrice: number;
      orderClass?: string;
      takeProfitLimitPrice?: number;
      stopLossStopPrice?: number;
    };
    ticket: TradeTicket;
    reasons: string[];
    blockers: string[];
    createdAt: string;
  }>;
  blocked?: BlockedBuyNowSignal[];
  advisory?: string;
  error?: string;
};

type ControlPlaneRunsApi = {
  ok: boolean;
  source?: "control-plane-v1" | string;
  latest?: OrchestrationRun | null;
  runs?: OrchestrationRun[];
  advisory?: string;
  error?: string;
};

type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  model?: string;
  source?: string;
  advisory?: string;
};

type AssistantChatApiResponse = {
  ok: boolean;
  answer?: string;
  model?: string;
  source?: string;
  advisory?: string;
  error?: string;
  configuredModels?: {
    primary: string;
    fallback: string;
    fast: string;
  };
};

type ResearchNote = {
  id: string;
  symbol: string;
  note_type: string;
  title: string;
  body: string;
  tags?: string[];
  source: string;
  created_at: string;
};

type StrategyProfile = {
  name: string;
  repo: string;
  description: string;
  expectedReturn: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  robustness: number;
};

const initialWatchlist = [
  "SPY",
  "QQQ",
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "AMD",
  "COIN",
  "GLD",
  "SLV",
  "USO",
  "UNG",
  "GOLD",
  "SILVER",
  "OIL",
  "NATGAS",
  "COPPER",
  "CORN",
  "WHEAT",
  "SOY",
  "BTCUSD",
  "ETHUSD",
];

const macroSignals = [
  { label: "Market Regime", value: "Risk-on, fragile", tone: "amber" },
  { label: "Liquidity", value: "Neutral", tone: "blue" },
  { label: "Volatility", value: "Compression watch", tone: "green" },
  { label: "Tonight Bias", value: "Research first", tone: "red" },
];

const agents = [
  {
    name: "Codex",
    role: "Builder and QA",
    task: "Turns research into dashboards, scanners, checklists, and deployment updates.",
  },
  {
    name: "OpenClaw",
    role: "Web intelligence",
    task: "Investigates catalysts, filings, social proof, competitors, and source quality.",
  },
  {
    name: "Hermes",
    role: "Deep research",
    task: "Builds structured briefs, scenario trees, and contrarian risk memos.",
  },
  {
    name: "KiloCode",
    role: "Automation sprint",
    task: "Creates scripts, backtests, exports, and quick workflow glue.",
  },
];

const playbooks = [
  "No live trade unless a written thesis, invalidation level, and position size exist first.",
  "Avoid chasing extended candles; prefer planned levels, alerts, and risk-defined entries.",
  "Separate research conviction from execution timing. Great companies can be bad trades.",
  "Every idea needs a bear case, a catalyst clock, and a max loss before it is actionable.",
];

const strategyTemplates = [
  "Momentum pullback",
  "Breakout retest",
  "Mean reversion",
  "Trend following",
  "Earnings reaction",
];

const quantPipelines = [
  {
    title: "Data Terminal",
    repo: "OpenBB",
    icon: Database,
    body: "Pull quotes, fundamentals, options, filings, macro series, and research snapshots into one normalized intelligence layer.",
  },
  {
    title: "Backtest Ladder",
    repo: "backtesting.py -> vectorbt -> LEAN",
    icon: GitBranch,
    body: "Validate simple logic first, sweep parameters second, then promote robust candidates to event-driven simulation.",
  },
  {
    title: "AI Research",
    repo: "FinGPT + FinRL",
    icon: Brain,
    body: "Summarize catalysts, score sentiment, flag contradictions, and keep reinforcement-learning work paper-only.",
  },
  {
    title: "Execution Gate",
    repo: "Nautilus + Jesse",
    icon: ShieldCheck,
    body: "Prepare professional trading rails and crypto lanes without enabling real-money execution by default.",
  },
];

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedUsd(value: number) {
  if (!Number.isFinite(value) || value === 0) return formatUsd(0);
  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function formatSignedPct(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0.00%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(value: number) {
  if (value > 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value > 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value > 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function moneyField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = Number(record?.[key]);
  return Number.isFinite(value) ? formatUsd(value) : "N/A";
}

function boolField(record: Record<string, unknown> | null | undefined, key: string) {
  return record?.[key] === true;
}

const integratedReferenceSummary = referenceReportSummary();

const assistantWelcomeMessage: AssistantChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content: "Ready for questions from the current cockpit context.",
  createdAt: "session",
  model: "gpt-5.2",
  source: "configured",
};

const assistantQuickQuestions = [
  "What risk is not obvious here?",
  "Why is the top buy blocked or actionable?",
  "What must happen before live execution?",
  "How did the reference reports change this setup?",
];

function makeSpark(symbol: string, price: number) {
  const seed = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 18 }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.4) * 0.018;
    const pulse = Math.cos((index + seed) / 3.3) * 0.011;
    return {
      label: `${index + 1}`,
      value: Number((price * (1 + wave + pulse + index * 0.0015)).toFixed(2)),
    };
  });
}

function normalizeStoredAssistantMessage(value: unknown): AssistantChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AssistantChatMessage>;
  const role = item.role === "user" || item.role === "assistant" ? item.role : null;
  const content = typeof item.content === "string" ? item.content.trim() : "";
  if (!role || !content) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : messageId(role),
    role,
    content: content.slice(0, 4000),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "session",
    model: typeof item.model === "string" ? item.model : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
    advisory: typeof item.advisory === "string" ? item.advisory : undefined,
  };
}

function messageId(role: AssistantChatMessage["role"]) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function predictionBrief(prediction: FusionPrediction | undefined) {
  if (!prediction) return null;
  return {
    symbol: prediction.symbol,
    name: prediction.name,
    action: prediction.action,
    direction: prediction.direction,
    score: prediction.score,
    confidence: prediction.confidence,
    thesis: prediction.thesis,
    entry: prediction.entry,
    stop: prediction.stop,
    target: prediction.target,
    rewardRisk: prediction.rewardRisk,
    expectedHold: prediction.expectedHold,
    maxHold: prediction.maxHold,
    operatorAction: prediction.operatorAction,
    blockers: prediction.blockers.slice(0, 5),
    topSupports: prediction.topSupports.slice(0, 3).map((finding) => ({
      label: finding.label,
      score: finding.score,
    })),
    topChallenges: prediction.topChallenges.slice(0, 3).map((finding) => ({
      label: finding.label,
      score: finding.score,
    })),
  };
}

function tradeTicketBrief(ticket: TradeTicket | null) {
  if (!ticket) return null;
  return {
    symbol: ticket.symbol,
    side: ticket.side,
    status: ticket.status,
    trigger: ticket.trigger,
    entry: ticket.entry,
    entrySignalNeeded: ticket.entrySignalNeeded,
    stop: ticket.stop,
    target: ticket.target,
    units: ticket.units,
    notional: ticket.notional,
    potentialUnits: ticket.potentialUnits,
    potentialNotional: ticket.potentialNotional,
    maxLoss: ticket.maxLoss,
    rewardRisk: ticket.rewardRisk,
    riskRewardRatio: ticket.riskRewardRatio,
    positionSize: ticket.positionSize,
    suggestedPositionSize: ticket.suggestedPositionSize,
    tradeable: ticket.tradeable,
    reason: ticket.reason,
    mustConfirm: ticket.mustConfirm.slice(0, 5),
    doNotTradeIf: ticket.doNotTradeIf.slice(0, 5),
  };
}

function buyNowBrief(signal: BuyNowSignal) {
  return {
    symbol: signal.symbol,
    price: signal.price,
    trigger: signal.trigger,
    stop: signal.stop,
    target: signal.target,
    confidence: signal.confidence,
    riskRewardRatio: signal.riskRewardRatio,
    potentialUnits: signal.potentialUnits,
    potentialNotional: signal.potentialNotional,
    positionSize: signal.positionSize,
    suggestedPositionSize: signal.suggestedPositionSize,
    entrySignalNeeded: signal.entrySignalNeeded,
    strategyMindset: {
      stance: signal.strategyMindset.stance,
      score: signal.strategyMindset.score,
      summary: signal.strategyMindset.summary,
      topVotes: signal.strategyMindset.votes.slice(0, 3).map((vote) => `${vote.name}: ${vote.stance}`),
    },
    reasons: signal.reasons.slice(0, 4),
    warnings: signal.warnings.slice(0, 4),
  };
}

function blockedBuyNowBrief(signal: BlockedBuyNowSignal) {
  return {
    symbol: signal.symbol,
    price: signal.price,
    trigger: signal.trigger,
    stop: signal.stop,
    target: signal.target,
    confidence: signal.confidence,
    rewardRisk: signal.rewardRisk,
    entrySignalNeeded: signal.entrySignalNeeded,
    positionSize: signal.positionSize,
    suggestedPositionSize: signal.suggestedPositionSize,
    strategyMindset: {
      stance: signal.strategyMindset.stance,
      score: signal.strategyMindset.score,
      summary: signal.strategyMindset.summary,
      topVotes: signal.strategyMindset.votes.slice(0, 3).map((vote) => `${vote.name}: ${vote.stance}`),
    },
    blockers: signal.blockers.slice(0, 5),
    reasons: signal.reasons.slice(0, 4),
  };
}

function buyLeadBrief(lead: BuyLead) {
  return {
    symbol: lead.symbol,
    status: lead.status,
    score: lead.score,
    confidence: lead.confidence,
    price: lead.price,
    trigger: lead.trigger,
    stop: lead.stop,
    target: lead.target,
    rewardRisk: lead.rewardRisk,
    expectedHold: lead.holdingPeriod.expectedHold,
    maxHold: lead.holdingPeriod.maxHold,
    reason: lead.reason,
    strategyMindset: {
      stance: lead.strategyMindset.stance,
      score: lead.strategyMindset.score,
      summary: lead.strategyMindset.summary,
      topVotes: lead.strategyMindset.votes.slice(0, 3).map((vote) => `${vote.name}: ${vote.stance}`),
    },
    warnings: lead.warnings.slice(0, 4),
    dataFresh: lead.dataFresh,
  };
}

function appendQuoteHistory(current: Record<string, SparkPoint[]>, quotes: Quote[]) {
  if (quotes.length === 0) return current;
  const label = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const next = { ...current };
  for (const quote of quotes) {
    if (!Number.isFinite(quote.price) || quote.price <= 0) continue;
    const existing = next[quote.symbol]?.length ? next[quote.symbol] : makeSpark(quote.symbol, quote.price).slice(-14);
    const point = { label, value: Number(quote.price.toFixed(2)) };
    next[quote.symbol] = [...existing, point].slice(-36);
  }
  return next;
}

function simulateStrategies(symbol: string, price: number, lookback: number, risk: number): StrategyProfile[] {
  const seed = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const volatility = Math.max(0.8, Math.min(3.2, ((seed % 17) + lookback / 10) / 8));
  const baseEdge = ((seed % 13) - 4) / 10 + risk * 0.16;
  return strategyTemplates.map((name, index) => {
    const cycle = Math.sin((seed + index * 11 + lookback) / 9);
    const expectedReturn = Number((baseEdge + cycle * 2.1 + index * 0.28).toFixed(2));
    const maxDrawdown = Number((volatility * (4.2 + index * 1.1 + risk * 0.7)).toFixed(2));
    const winRate = Math.max(34, Math.min(68, Math.round(48 + cycle * 8 + index * 1.7)));
    const trades = Math.max(4, Math.round(34 - lookback / 4 + index * 6));
    const robustness = Math.max(
      1,
      Math.min(100, Math.round(58 + expectedReturn * 4 - maxDrawdown * 1.4 + winRate * 0.35)),
    );
    const repo = index === 0 ? "backtesting.py" : index === 1 ? "vectorbt" : index === 2 ? "Backtrader" : index === 3 ? "LEAN" : "FinGPT filter";
    return { name, repo, description: `${symbol} @ ${formatUsd(price)} with ${lookback}D lookback`, expectedReturn, maxDrawdown, winRate, trades, robustness };
  });
}

const dashboardSections = [
  { id: "overview", label: "Overview" },
  { id: "actions", label: "Actions" },
  { id: "intelligence", label: "Intelligence" },
  { id: "analyst-chat", label: "Chat" },
  { id: "leads", label: "Leads" },
  { id: "operations", label: "Ops" },
  { id: "risk", label: "Risk" },
  { id: "journal", label: "Journal" },
];

const sectionExplanations: Record<string, string> = {
  "Fusion Alpha Command": "The combined model view. It ranks buy, sell, hold, and data-review decisions from all available engines.",
  "AI Agent Trading": "Shows supervised agent proposals. Paper actions are allowed only when policy and broker readiness pass.",
  "Algorithm Council": "Scores fundamentals, quality, valuation, profitability, and momentum so signals are not based on price alone.",
  "Institutional Gates": "Checks whether proof, controls, workers, and compliance boundaries are strong enough to trust the platform operationally.",
  "Research Stack": "Shows which paid providers, public fallbacks, and research workers are actually available right now.",
  "Ising Basket Optimizer": "Chooses a limited basket of buy leads while respecting budget, risk, and overlap constraints.",
  "Live Buy Leads": "Ranks symbols closest to a buy setup. These are candidates to watch, not automatic orders.",
  "Live Buy / Sell Leaderboard": "Compares the strongest buy leads against sell or exit watches using confidence, risk, and urgency.",
  "Always-On Trading OS": "Operational controls for monitoring, broker readiness, position sizing, and paper-trade analytics.",
  "Trust Matrix": "The proof matrix. It shows every issue as live-tracked while keeping proof readiness separate from tracking status.",
  "Market Signal Monitor": "Rule-based market scan that flags buy-watch and sell-watch setups from fresh quote data.",
  "Day Trading Playbook": "The rules used to judge whether a setup is actionable or should be avoided.",
  "Data Feed Control": "Controls the quote provider and shows which feeds are active, public, unofficial, delayed, or licensed.",
  "Market Radar": "The watchlist. Select a symbol here to update the chart, ticket, journal, and analysis panels.",
  "Quant Lab": "Runs backtests, research experiments, debates, and fusion analysis before ideas are promoted.",
  "Engine Fusion Map": "Shows how each research engine contributed evidence or blockers for the selected symbol.",
  "Paper Trade Journal": "Stores the written thesis, invalidation, confidence, and risk for auditability.",
  "Paper Tickets": "Saved simulated trade plans. They are evidence records, not live brokerage orders.",
  "Build Order": "The recommended implementation order for making the platform safer and more complete.",
  "Event Risk Calendar": "Scheduled market events that can invalidate signals or raise execution risk.",
  "Best Practices": "Plain risk rules that should constrain every trade decision.",
  "Research Pipeline": "The data and research flow from raw signal to validated trade idea.",
  "Repo Features Added": "Major capabilities that were added to this codebase and what each one contributes.",
  "Intelligence Brief": "High-level market and system context for the current dashboard state.",
  Headlines: "External news linked to watchlist symbols. Use these as context, not confirmation.",
  "Agent Desk": "Background agent roles and what each one is responsible for.",
  "Risk Constitution": "Hard trading constraints that prevent impulsive or under-specified execution.",
};

const metricExplanations: Record<string, string> = {
  Feed: "Current quote and data-provider condition. If degraded or stale, decisions should be treated as blocked or research-only.",
  "Market Scan": "How many watchlist symbols are positive and how many are moving enough to deserve attention.",
  "Proof Coverage": "Share of trust systems with live or partial evidence. Higher means signals have more supporting infrastructure.",
  Signals: "Count of immediate buy-now signals and slower buy leads. Buy-now is stricter than buy-lead.",
  "Fusion Alpha": "Top combined model score after engines, rules, catalysts, and risk checks are merged.",
  "Algorithm Council": "Top fundamental and quantitative council score for the current watchlist.",
  "Institutional Gates": "Whether required proof and control checks are ready or still gated.",
  "Research Stack": "How many configured research providers are available and what readiness grade they currently have.",
  "Control Plane": "Latest orchestration chain status across research, thesis, backtest, risk review, paper gate, and live gate.",
};

const statExplanations: Record<string, string> = {
  "Model Score": "Derived score from the fusion model. This is not a market fact, exchange indicator, or trading recommendation.",
  "Evidence Confidence": "Derived confidence based on available evidence, data freshness, agreement, and blockers. This is not an audited factual indicator.",
  Fusion: "Combined score from the fusion model. It is a ranking input, not permission to trade.",
  Trust: "Confidence in the available evidence behind the decision.",
  Timeframe: "The expected trading window for this setup.",
  "Expected Hold": "How long the system expects the position or watch to remain relevant.",
  "Max Hold": "The longest acceptable holding window before the setup should be reviewed again.",
  "Forecast P/L": "Projected profit or loss from the current modeled setup.",
  "Avoided downside": "Estimated loss avoided by not taking or by exiting the setup.",
  Move: "Expected or observed price move in percent.",
  "Max Loss": "Worst modeled loss for this plan under the current stop or risk assumptions.",
  Entry: "The price level where the plan would begin, usually a limit or trigger.",
  Stop: "The invalidation price. If reached, the thesis is wrong or risk must be cut.",
  Target: "The planned price objective for taking profit or reassessing.",
  "Units / Notional": "Estimated quantity and dollar exposure for the trade plan.",
  Trigger: "The price that must be reached before a watch becomes actionable.",
  Score: "Setup quality score. Use it to rank candidates, not as a standalone trading signal.",
  Horizon: "The intended time horizon for the setup.",
  Hold: "Plain-English hold guidance for the setup.",
  "Buy now": "Signals that passed immediate-entry checks.",
  "Buy leads": "Candidates near a buy setup but not necessarily ready for execution.",
  "Sell watch": "Symbols with sell, avoid, or exit risk conditions.",
  Now: "Current market price from the selected feed.",
  Price: "Latest quoted price.",
  Quality: "Signal grade and confidence from the scoring engine.",
  Invalidation: "The level where this signal should no longer be trusted.",
  "R/R": "Reward-to-risk ratio. Higher means more expected reward per unit of loss risk.",
  "Risk/Reward": "Reward-to-risk ratio for the displayed entry. Higher means more expected reward per unit of loss risk.",
  Shares: "Estimated share count from account size, risk, entry, and stop.",
  "Risk $": "Dollar amount at risk if the stop is hit.",
  Notional: "Total dollar exposure of the position.",
  "Potential Size": "The maximum modeled unit count and notional exposure before final tradeability gates.",
  "Position Size": "The current unit count and notional exposure after account, risk, stop, and daily-loss caps.",
  "Suggested Size": "Plain-English size recommendation derived from the current risk budget and stop distance.",
  "Entry Signal Needed": "The exact condition required before the setup can be treated as an entry candidate.",
  "Entry Signal": "The exact condition required before the setup can be treated as an entry candidate.",
  "Strategy Minds": "Consensus score from strategy archetypes inspired by notable traders and investors. It is evidence, not a standalone order.",
  Reports: "Reference reports currently summarized into the system rules.",
  Research: "Reference-report lessons categorized as research evidence.",
  Gates: "Reference-report lessons categorized as execution or risk gates.",
  "Issue Status": "How many Trust Matrix rows are actively tracked live.",
  "Open Proof": "Trust capabilities that are live-tracked but not fully proven yet.",
  "Open Issues": "Trust capabilities that are live-tracked but not fully proven yet.",
  "Critical Open": "Critical proof, data, risk, or execution issues that still need work.",
  "Proof Ready": "Trust capabilities whose proof state is live.",
  Resolved: "Trust capabilities whose proof state is live and should remain monitored.",
  "Proof Coverage": "Weighted share of trust systems that have live or partial evidence.",
  "Max Day Loss": "Maximum daily dollar loss allowed by the current risk settings.",
  Notes: "Saved journal note count.",
  "Avg Conf": "Average confidence across saved journal entries.",
  "Avg Risk": "Average risk percent across saved journal entries.",
  Mode: "Current execution context for saved analytics.",
};

const statusExplanations: Record<string, string> = {
  System: "Overall dashboard health from the latest refresh.",
  Selected: "The symbol currently driving charts, tickets, notes, and analysis panels.",
  Feed: "Quote feed quality and freshness. Stale feeds should block execution decisions.",
  Broker: "Broker order rail readiness. Locked means orders cannot be placed from this screen.",
  Refresh: "When the dashboard last completed a data refresh.",
  "Trade ticket": "Whether the app can construct an auditable trade ticket.",
  "Proof systems": "How many trust systems are proven live or still partial.",
  "Critical issues": "Critical trust issues that still need implementation or enough proof.",
  "Broker rail": "Current broker execution readiness.",
  "AITable mirror": "Whether external table mirroring is configured and reachable.",
  "Production core": "Whether the platform's required production capabilities are ready.",
  Capabilities: "Configured operational capabilities that are active right now.",
  "Broker risk": "Number of current risk flags from broker/account data.",
  "Signal proof": "Outcome evidence currently available for generated signals.",
  "Data license": "Whether market data is paid/licensed, public, or fallback-only.",
  "Control Plane": "Latest research-to-execution orchestration run and whether paper/live gates are blocked, pending review, or ready.",
};

const provenanceExplanations: Record<string, string> = {
  live: "Live or near-live data from an external provider or broker API.",
  derived: "Calculated by this app from quotes, rules, risk settings, and available evidence.",
  proxy: "Approximation used when a named external worker or institutional-grade data source is not connected.",
  blocked: "Not available for action because data, broker, or risk requirements are missing.",
};

export default function Home() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastSignalAlertRef = useRef("");
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === "undefined") return initialWatchlist;
    const saved = window.localStorage.getItem("ti_watchlist");
    if (!saved) return initialWatchlist;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return initialWatchlist;
      const cleaned = parsed.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean);
      return Array.from(new Set([...cleaned, ...initialWatchlist])).slice(0, 24);
    } catch {
      return initialWatchlist;
    }
  });
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteHistory, setQuoteHistory] = useState<Record<string, SparkPoint[]>>({});
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selected, setSelected] = useState("NVDA");
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Booting market intelligence");
  const [provider, setProvider] = useState("auto");
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [clockNow, setClockNow] = useState<number>(() => new Date().getTime());
  const [lookback, setLookback] = useState(30);
  const [backtestRisk, setBacktestRisk] = useState(1.5);
  const [monitorSeconds, setMonitorSeconds] = useState(15);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [accountSize, setAccountSize] = useState(10000);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(3);
  const [brokerMode, setBrokerMode] = useState<BrokerMode>("paper");
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus | null>(null);
  const [brokerOverview, setBrokerOverview] = useState<BrokerOverview | null>(null);
  const [aitableStatus, setAitableStatus] = useState<AitableStatus | null>(null);
  const [opsStatus, setOpsStatus] = useState<OpsStatus | null>(null);
  const [riskStatus, setRiskStatus] = useState<RiskApiResponse | null>(null);
  const [modelPerformance, setModelPerformance] = useState<ModelPerformanceApi | null>(null);
  const [realBacktest, setRealBacktest] = useState<BacktestApiResponse | null>(null);
  const [algorithmCouncil, setAlgorithmCouncil] = useState<AlgorithmCouncilResponse | null>(null);
  const [institutionalReadiness, setInstitutionalReadiness] = useState<InstitutionalReadinessApi | null>(null);
  const [researchStack, setResearchStack] = useState<ResearchStackApi | null>(null);
  const [autoResearch, setAutoResearch] = useState<AutoResearchApi | null>(null);
  const [tradingAgents, setTradingAgents] = useState<TradingAgentsApi | null>(null);
  const [fusionAlpha, setFusionAlpha] = useState<FusionAlphaApi | null>(null);
  const [agentTrader, setAgentTrader] = useState<AgentTraderApi | null>(null);
  const [orchestration, setOrchestration] = useState<ControlPlaneRunsApi | null>(null);
  const [researchNotes, setResearchNotes] = useState<ResearchNote[]>([]);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [autoResearchRunning, setAutoResearchRunning] = useState(false);
  const [tradingAgentsRunning, setTradingAgentsRunning] = useState(false);
  const [fusionRunning, setFusionRunning] = useState(false);
  const [orchestrationRunning, setOrchestrationRunning] = useState(false);
  const [quantMessage, setQuantMessage] = useState("Choose a lab action to run evidence before paper promotion.");
  const [agentExecuting, setAgentExecuting] = useState(false);
  const [brokerMessage, setBrokerMessage] = useState("Checking broker rail");
  const [agentMessage, setAgentMessage] = useState("Agent trading is supervised.");
  const [executionAck, setExecutionAck] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("ti_journal");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("ti_paper_trades");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState({
    symbol: "NVDA",
    setup: "Momentum pullback",
    thesis: "",
    invalidation: "",
    confidence: 62,
    risk: 1,
  });
  const [assistantMessages, setAssistantMessages] = useState<AssistantChatMessage[]>(() => {
    if (typeof window === "undefined") return [assistantWelcomeMessage];
    const saved = window.localStorage.getItem("ti_assistant_chat");
    if (!saved) return [assistantWelcomeMessage];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [assistantWelcomeMessage];
      const messages = parsed
        .map((item) => normalizeStoredAssistantMessage(item))
        .filter((item): item is AssistantChatMessage => Boolean(item))
        .slice(-20);
      return messages.length ? messages : [assistantWelcomeMessage];
    } catch {
      return [assistantWelcomeMessage];
    }
  });
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantModelLabel, setAssistantModelLabel] = useState("gpt-5.2");

  useEffect(() => {
    window.localStorage.setItem("ti_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    window.localStorage.setItem("ti_journal", JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    window.localStorage.setItem("ti_paper_trades", JSON.stringify(paperTrades));
  }, [paperTrades]);

  useEffect(() => {
    window.localStorage.setItem("ti_assistant_chat", JSON.stringify(assistantMessages.slice(-20)));
  }, [assistantMessages]);

  async function refresh() {
    setLoading(true);
    setStatus("Refreshing quotes and headlines");
    const symbolParam = watchlist.join(",");
    try {
      const [
        marketResponse,
        newsResponse,
        brokerResponse,
        aitableResponse,
        opsResponse,
        riskResponse,
        performanceResponse,
        algorithmResponse,
        institutionalResponse,
        researchStackResponse,
        autoResearchResponse,
        agentTraderResponse,
        researchNotesResponse,
        orchestrationResponse,
      ] = await Promise.all([
        fetch(`/api/market?symbols=${encodeURIComponent(symbolParam)}&provider=${encodeURIComponent(provider)}`),
        fetch(`/api/news?symbols=${encodeURIComponent(watchlist.slice(0, 6).join(","))}`),
        fetch(`/api/broker/overview?mode=${brokerMode}`),
        fetch("/api/integrations/aitable/readiness"),
        fetch("/api/ops/status"),
        fetch(`/api/risk/portfolio?mode=${brokerMode}&maxDailyLossPct=${maxDailyLossPct}`),
        fetch("/api/model-performance"),
        fetch(`/api/algorithms?symbols=${encodeURIComponent(watchlist.slice(0, 12).join(","))}&provider=${encodeURIComponent(provider)}`),
        fetch("/api/institutional/readiness"),
        fetch("/api/research-stack/readiness"),
        fetch("/api/autoresearch/lab?limit=5"),
        fetch(`/api/agent-trader/proposals?mode=${brokerMode}&symbols=${encodeURIComponent(symbolParam)}&provider=${encodeURIComponent(provider)}&accountSize=${accountSize}&riskPct=${draft.risk}&maxDailyLossPct=${maxDailyLossPct}`),
        fetch("/api/research-notes?limit=20"),
        fetch("/api/control-plane/runs?limit=3"),
      ]);
      const marketData = await marketResponse.json();
      const newsData = await newsResponse.json();
      const brokerData = await brokerResponse.json();
      const aitableData = await aitableResponse.json();
      const opsData = await opsResponse.json();
      const riskData = await riskResponse.json();
      const performanceData = await performanceResponse.json();
      const algorithmData = await algorithmResponse.json();
      const institutionalData = await institutionalResponse.json();
      const researchStackData = await researchStackResponse.json();
      const autoResearchData = await autoResearchResponse.json();
      const agentTraderData = await agentTraderResponse.json();
      const researchNotesData = await researchNotesResponse.json().catch(() => ({ ok: false }));
      const orchestrationData = await orchestrationResponse.json().catch(() => ({ ok: false }));
      const freshQuotes = marketData.quotes ?? [];
      setQuotes(freshQuotes);
      setQuoteHistory((current) => appendQuoteHistory(current, freshQuotes));
      setNews(newsData.items ?? []);
      setAitableStatus(aitableData.ok ? aitableData : null);
      setOpsStatus(opsData.ok ? opsData : null);
      setRiskStatus(riskData.ok ? riskData : null);
      setModelPerformance(performanceData.ok ? performanceData : null);
      setAlgorithmCouncil(algorithmData.ok ? algorithmData : { ok: false, error: algorithmData.error ?? "Algorithm council unavailable" });
      setInstitutionalReadiness(institutionalData.ok ? institutionalData : null);
      setResearchStack(researchStackData.ok ? researchStackData : null);
      setAutoResearch(autoResearchData.ok ? autoResearchData : null);
      setAgentTrader(agentTraderData.ok || agentTraderData.policy ? agentTraderData : null);
      setResearchNotes(researchNotesData.ok ? researchNotesData.notes ?? [] : []);
      setOrchestration(orchestrationData.ok ? orchestrationData : null);
      const nextBrokerStatus = brokerData.ok ? brokerData.readiness : brokerData.readiness ?? null;
      setBrokerStatus(nextBrokerStatus);
      setBrokerOverview(brokerData.ok ? brokerData : null);
      setBrokerMessage(
        nextBrokerStatus?.orderPlacementReady
          ? `${nextBrokerStatus.mode === "live" ? "Live" : "Paper"} broker orders armed`
          : `Broker locked: ${(nextBrokerStatus?.missing ?? [brokerData.error ?? "configuration incomplete"]).join(", ")}`,
      );
      setLastRefreshAt(new Date());
      setStatus(
        marketData.error
          ? `Market data unavailable: ${marketData.error}`
          : marketData.degraded
            ? "Live feed degraded; some symbols unavailable"
            : "Live research feed online",
      );
    } catch {
      setStatus("Network issue, using cached workspace state");
    } finally {
      setLoading(false);
    }
  }

  async function runRealBacktest() {
    setBacktestRunning(true);
    setRealBacktest(null);
    setQuantMessage("Running historical backtest with slippage and fee assumptions.");
    try {
      const symbols = [selected, ...watchlist.filter((symbol) => !["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY", "BTCUSD", "ETHUSD"].includes(symbol))]
        .filter(Boolean)
        .slice(0, 8);
      const response = await fetch(
        `/api/backtest?mode=${brokerMode}&symbols=${encodeURIComponent(Array.from(new Set(symbols)).join(","))}&lookbackDays=${Math.max(45, lookback * 3)}&slippageBps=5&feeBps=1`,
      );
      const payload = await response.json();
      setRealBacktest(payload);
      setQuantMessage(payload.ok ? "Backtest complete. Results are shown below." : (payload.error ?? "Backtest could not run."));
    } catch {
      setRealBacktest({ ok: false, error: "Backtest request failed." });
      setQuantMessage("Backtest request failed.");
    } finally {
      setBacktestRunning(false);
    }
  }

  async function runAutoResearch() {
    setAutoResearchRunning(true);
    setQuantMessage("Running AutoResearch candidates against the selected watchlist.");
    try {
      const symbols = [selected, ...watchlist]
        .filter((symbol) => !["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY", "BTCUSD", "ETHUSD"].includes(symbol))
        .filter(Boolean)
        .slice(0, 6);
      const response = await fetch(`/api/autoresearch/lab?mode=${brokerMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: Array.from(new Set(symbols)).join(","),
          lookbackDays: Math.max(60, lookback * 3),
          budget: 3,
        }),
      });
      const payload = await response.json();
      setAutoResearch(payload);
      setQuantMessage(payload.ok ? "AutoResearch complete. Champion and experiments are shown below." : (payload.error ?? "AutoResearch could not run."));
    } catch {
      setAutoResearch({ ok: false, error: "AutoResearch request failed." });
      setQuantMessage("AutoResearch request failed.");
    } finally {
      setAutoResearchRunning(false);
    }
  }

  async function runTradingAgents() {
    setTradingAgentsRunning(true);
    setTradingAgents(null);
    setQuantMessage("Running in-app TradingAgents debate.");
    try {
      const symbols = [selected, ...watchlist]
        .filter((symbol) => !["GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "CORN", "WHEAT", "SOY"].includes(symbol))
        .filter(Boolean)
        .slice(0, 4);
      const response = await fetch("/api/tradingagents/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: Array.from(new Set(symbols)),
          depth: "standard",
        }),
      });
      const payload = await response.json();
      setTradingAgents(payload);
      setQuantMessage(
        payload.ok
          ? payload.source === "native-codebase-debate"
            ? "In-app TradingAgents debate complete. Decisions are shown below."
            : "TradingAgents debate complete. Decisions are shown below."
          : (payload.error ?? "TradingAgents could not run."),
      );
      if (payload.ok) {
        void refresh();
      }
    } catch {
      setTradingAgents({ ok: false, error: "TradingAgents request failed." });
      setQuantMessage("TradingAgents request failed.");
    } finally {
      setTradingAgentsRunning(false);
    }
  }

  async function runFusionAlpha() {
    setFusionRunning(true);
    setQuantMessage("Running Fusion Alpha across the engine map, algorithm council, backtest, and native agent debate.");
    try {
      const symbols = [selected, ...watchlist]
        .filter(Boolean)
        .slice(0, 8);
      const response = await fetch(
        `/api/fusion-alpha?mode=${brokerMode}&symbols=${encodeURIComponent(Array.from(new Set(symbols)).join(","))}&provider=${encodeURIComponent(provider)}&lookbackDays=${Math.max(60, lookback * 3)}&accountSize=${accountSize}&riskPct=${draft.risk}&maxDailyLossPct=${maxDailyLossPct}&depth=standard`,
      );
      const payload = await response.json();
      setFusionAlpha(payload);
      setQuantMessage(payload.ok ? "Fusion Alpha complete. The highest-level buy/sell prediction is shown above and in the engine map." : (payload.error ?? "Fusion Alpha could not run."));
    } catch {
      setFusionAlpha({ ok: false, error: "Fusion Alpha request failed." });
      setQuantMessage("Fusion Alpha request failed.");
    } finally {
      setFusionRunning(false);
    }
  }

  async function runControlPlane() {
    setOrchestrationRunning(true);
    setQuantMessage("Running control-plane chain: research, thesis, backtest, risk review, paper gate, and live gate.");
    try {
      const symbols = [selected, ...watchlist]
        .filter(Boolean)
        .slice(0, 8);
      const response = await fetch(`/api/control-plane/runs?mode=${brokerMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: Array.from(new Set(symbols)).join(","),
          provider,
          accountSize,
          riskPct: draft.risk,
          maxDailyLossPct,
          lookbackDays: Math.max(60, lookback * 3),
        }),
      });
      const payload = await response.json();
      if (payload.run) {
        setOrchestration((current) => ({
          ok: Boolean(payload.ok),
          source: payload.source,
          latest: payload.run,
          runs: [payload.run, ...(current?.runs ?? []).filter((run) => run.id !== payload.run.id)].slice(0, 3),
          advisory: payload.advisory,
          error: payload.error,
        }));
      }
      setQuantMessage(
        payload.run
          ? `Control-plane run ${payload.run.status}: ${payload.run.decision.nextAction}`
          : (payload.error ?? "Control-plane run could not start."),
      );
    } catch {
      setOrchestration({ ok: false, error: "Control-plane run request failed.", latest: null, runs: [] });
      setQuantMessage("Control-plane run request failed.");
    } finally {
      setOrchestrationRunning(false);
    }
  }

  async function runPaperAgent(symbol?: string) {
    setAgentExecuting(true);
    setAgentMessage("Asking the agent to submit a paper-only order.");
    try {
      const response = await fetch(`/api/agent-trader/execute?mode=paper`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          symbols: watchlist.join(","),
          provider,
          accountSize,
          riskPct: draft.risk,
          maxDailyLossPct,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setAgentMessage(payload.error ?? "Agent paper execution did not run.");
        if (payload.policy || payload.proposal) {
          setAgentTrader((current) => ({
            ok: false,
            mode: "paper",
            policy: payload.policy ?? current?.policy,
            proposals: payload.proposal ? [payload.proposal] : current?.proposals,
            blocked: payload.blocked ?? current?.blocked,
            error: payload.error,
          }));
        }
        return;
      }
      setAgentMessage(`Paper agent submitted ${payload.proposal?.symbol ?? "the selected"} bracket limit order.`);
      void refresh();
    } catch {
      setAgentMessage("Agent paper execution request failed.");
    } finally {
      setAgentExecuting(false);
    }
  }

  async function placeBrokerOrder(ticket: TradeTicket | null, modeOverride?: BrokerMode) {
    if (!ticket) return;
    const requestedMode = modeOverride ?? brokerMode;
    setPlacingOrder(true);
    setBrokerMessage(`Submitting ${requestedMode} broker order request`);
    const clientOrderId = `ti-${ticket.symbol}-${crypto.randomUUID().slice(0, 18)}`;
    try {
      const response = await fetch(`/api/broker/orders?mode=${requestedMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: ticket.symbol,
          side: ticket.side === "Buy" ? "buy" : "sell",
          qty: ticket.units,
          type: "limit",
          limitPrice: ticket.entry,
          timeInForce: "day",
          extendedHours: false,
          acknowledgement: executionAck,
          source: "trade-ticket",
          clientOrderId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setBrokerMessage(payload.error ?? "Broker rejected the order request.");
        return;
      }
      setBrokerMessage(`${payload.mode === "live" ? "LIVE" : "PAPER"} order submitted to Alpaca. Broker id: ${payload.brokerOrder?.id ?? "pending"}`);
      if (payload.mode !== "live") {
        void savePaperTrade(ticket);
      }
    } catch {
      setBrokerMessage("Broker request failed before submission.");
    } finally {
      setPlacingOrder(false);
    }
  }

  function changeBrokerMode(mode: BrokerMode) {
    setBrokerMode(mode);
    setExecutionAck("");
    setBrokerMessage(`Checking ${mode} broker rail`);
  }

  useEffect(() => {
    const kick = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(refresh, monitorSeconds * 1000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.join(","), monitorSeconds, provider, brokerMode, maxDailyLossPct]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date().getTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleSelect(event: Event) {
      const symbol = (event as CustomEvent<string>).detail;
      if (symbol) {
        setSelected(symbol);
        setDraft((current) => ({ ...current, symbol }));
      }
    }
    window.addEventListener("select-signal-symbol", handleSelect);
    return () => window.removeEventListener("select-signal-symbol", handleSelect);
  }, []);

  const selectedQuote = quotes.find((quote) => quote.symbol === selected) ?? quotes[0];
  const ranked = useMemo(
    () => [...quotes].sort((a, b) => scoreQuote(b) - scoreQuote(a)),
    [quotes],
  );
  const spark = selectedQuote ? makeSpark(selectedQuote.symbol, selectedQuote.price) : [];
  const strategies = selectedQuote
    ? simulateStrategies(selectedQuote.symbol, selectedQuote.price, lookback, backtestRisk)
    : [];
  const bestStrategy = [...strategies].sort((a, b) => b.robustness - a.robustness)[0];
  const signals = useMemo(() => generateSignals(quotes, draft.risk), [quotes, draft.risk]);
  const buyLeads = useMemo(() => generateBuyLeads(quotes, draft.risk), [quotes, draft.risk]);
  const buyNowResult = useMemo(
    () =>
      generateBuyNowSignals({
        quotes,
        accountSize,
        riskPct: draft.risk,
        maxDailyLossPct,
      }),
    [quotes, accountSize, draft.risk, maxDailyLossPct],
  );
  const buyNowSignals = buyNowResult.buyNow;
  const blockedBuyNowSignals = buyNowResult.blocked;
  const algorithmScores = useMemo(() => algorithmCouncil?.scores ?? [], [algorithmCouncil]);
  const fusionPredictions = useMemo(
    () =>
      fusionAlpha?.ok && fusionAlpha.predictions?.length
        ? fusionAlpha.predictions
        : buildFusionAlphaPredictions({
            quotes,
            signals,
            buyLeads,
            buyNow: buyNowSignals,
            blockedBuyNow: blockedBuyNowSignals,
            algorithmScores,
            backtestResults: realBacktest?.results ?? [],
            tradingAgents: tradingAgents?.decisions ?? [],
            researchComponents: researchStack?.components ?? [],
            newsItems: news,
            brokerReady: Boolean(brokerStatus?.orderPlacementReady),
            accountSize,
            riskPct: draft.risk,
            maxDailyLossPct,
          }),
    [
      fusionAlpha,
      quotes,
      signals,
      buyLeads,
      buyNowSignals,
      blockedBuyNowSignals,
      algorithmScores,
      realBacktest,
      tradingAgents,
      researchStack,
      news,
      brokerStatus,
      accountSize,
      draft.risk,
      maxDailyLossPct,
    ],
  );
  const topFusionPrediction = fusionPredictions[0];
  const selectedFusionPrediction = fusionPredictions.find((prediction) => prediction.symbol === selectedQuote?.symbol) ?? topFusionPrediction;
  const buyDecision =
    fusionPredictions.find((prediction) => prediction.direction === "buy" && prediction.action !== "Data Review") ??
    fusionPredictions.find((prediction) => prediction.direction === "buy") ??
    topFusionPrediction;
  const sellDecision =
    fusionPredictions.find((prediction) => prediction.direction === "sell" && prediction.symbol !== buyDecision?.symbol) ??
    fusionPredictions.find((prediction) => prediction.direction === "review" && prediction.symbol !== buyDecision?.symbol) ??
    fusionPredictions.find((prediction) => prediction.symbol !== buyDecision?.symbol) ??
    topFusionPrediction;
  const latestOrchestrationRun = orchestration?.latest ?? orchestration?.runs?.[0] ?? null;
  const topAlgorithmScore = algorithmScores[0];
  const institutionalGrade = institutionalReadiness?.productionInstitutionalReady
    ? "Ready"
    : institutionalReadiness?.proof?.grade
      ? `Gates ${institutionalReadiness.proof.summary.passed}/${institutionalReadiness.proof.gates.length}`
      : "Checking";
  const isingBasket = useMemo(
    () =>
      optimizeTradeBasketFromLeads({
        buyLeads,
        accountSize,
        riskPct: draft.risk,
        maxDailyLossPct,
        budget: accountSize * 0.35,
        maxRiskDollars: accountSize * (maxDailyLossPct / 100),
        maxPositions: 3,
        seed: quotes.map((quote) => `${quote.symbol}:${quote.price}:${quote.updatedAt}`).join("|"),
      }),
    [buyLeads, accountSize, draft.risk, maxDailyLossPct, quotes],
  );
  const leaderboard = useMemo(() => {
    const qualityRank = { A: 4, B: 3, C: 2, Avoid: 1 };
    const actionRank = { "Buy Watch": 3, "Sell/Exit Watch": 2, "Hold/No Trade": 1 };
    return [...signals].sort(
      (a, b) =>
        actionRank[b.action] - actionRank[a.action] ||
        qualityRank[b.quality] - qualityRank[a.quality] ||
        b.confidence - a.confidence ||
        b.rewardRisk - a.rewardRisk,
    );
  }, [signals]);
  const sellLeaders = leaderboard.filter((signal) => signal.action === "Sell/Exit Watch").slice(0, 5);
  const activeBuyLeads = buyLeads.filter((lead) => lead.status !== "No Buy");
  const visibleBuyLeads = (activeBuyLeads.length ? activeBuyLeads : buyLeads).slice(0, 5);
  const topSignal = signals[0];
  const topBuyLead = activeBuyLeads[0] ?? buyLeads[0];
  const selectedBuyLead = buyLeads.find((lead) => lead.symbol === selectedQuote?.symbol) ?? topBuyLead;
  const tradeTicket = selectedBuyLead
    ? buildBuyTradeTicket({
        lead: selectedBuyLead,
        accountSize,
        riskPct: draft.risk,
        maxDailyLossPct,
      })
    : null;

  function selectFusionDecision(prediction: FusionPrediction | undefined) {
    if (!prediction) return;
    setSelected(prediction.symbol);
    setDraft((current) => ({ ...current, symbol: prediction.symbol }));
  }

  function ticketForFusionPrediction(prediction: FusionPrediction | undefined): TradeTicket | null {
    if (!prediction || !prediction.entry || !prediction.stop || !prediction.target) return null;
    const lead = buyLeads.find((item) => item.symbol === prediction.symbol);
    if (lead) {
      return buildBuyTradeTicket({
        lead,
        accountSize,
        riskPct: draft.risk,
        maxDailyLossPct,
      });
    }

    const tradeable = prediction.direction === "buy" && prediction.action !== "Data Review" && prediction.forecast.units > 0;
    const riskBudgetDollars = Number(Math.min(accountSize * (draft.risk / 100), accountSize * (maxDailyLossPct / 100)).toFixed(2));
    const dailyLossCapDollars = Number((accountSize * (maxDailyLossPct / 100)).toFixed(2));
    const unitRisk = Number(Math.abs(prediction.entry - prediction.stop).toFixed(2));
    const positionSize =
      prediction.forecast.units > 0
        ? `${prediction.forecast.units} units / ${formatUsd(prediction.forecast.notional)} notional`
        : "0 units / no position";
    return {
      symbol: prediction.symbol,
      name: prediction.name,
      side: "Buy",
      status: tradeable ? "Ready to Watch" : "Blocked",
      trigger: prediction.entry,
      entry: prediction.entry,
      entrySignalNeeded: `Fresh ${prediction.symbol} quote remains at or above ${formatUsd(prediction.entry)} while Fusion Alpha stays buy-rated.`,
      stop: prediction.stop,
      target: prediction.target,
      units: prediction.forecast.units,
      notional: prediction.forecast.notional,
      potentialUnits: prediction.forecast.units,
      potentialNotional: prediction.forecast.notional,
      maxLoss: prediction.forecast.maxLoss,
      rewardRisk: prediction.rewardRisk ?? 0,
      riskRewardRatio: prediction.rewardRisk ?? 0,
      riskPct: draft.risk,
      riskBudgetDollars,
      dailyLossCapDollars,
      unitRisk,
      positionSize,
      suggestedPositionSize:
        prediction.forecast.units > 0
          ? `${positionSize}, risking about ${formatUsd(prediction.forecast.maxLoss)} against a ${formatUsd(riskBudgetDollars)} active risk budget.`
          : "No suggested size until the forecast has a valid unit count.",
      holdingPeriod: prediction.horizon,
      expectedHold: prediction.expectedHold,
      maxHold: prediction.maxHold,
      reviewCadence: prediction.reviewCadence,
      exitRule: "Exit at target, stop, max-hold expiry, or when Fusion Alpha downgrades below Hold.",
      tradeable,
      reason: prediction.thesis,
      mustConfirm: [
        `Holding period: ${prediction.expectedHold}.`,
        "The quote is fresh and the broker rail accepts this asset class.",
        "Spread, liquidity, and event risk are acceptable before entry.",
      ],
      doNotTradeIf: [
        "Fusion Alpha returns Data Review or a stale quote warning.",
        `Price trades through the invalidation level at ${formatUsd(prediction.stop)}.`,
        "You cannot accept the displayed max loss.",
      ],
    };
  }

  async function handleFusionPaperDecision(prediction: FusionPrediction | undefined) {
    selectFusionDecision(prediction);
    if (!prediction) return;
    if (prediction.direction !== "buy" || prediction.action === "Data Review") {
      setAgentMessage(`${prediction.symbol}: ${prediction.action}. Paper agent will not open a new long from this decision.`);
      return;
    }
    await runPaperAgent(prediction.symbol);
  }

  async function handleFusionLiveDecision(prediction: FusionPrediction | undefined) {
    selectFusionDecision(prediction);
    if (!prediction) return;
    if (prediction.direction !== "buy" || prediction.action === "Data Review") {
      setBrokerMessage(`${prediction.symbol}: ${prediction.action}. No new live long order was submitted from this decision.`);
      return;
    }
    if (brokerMode !== "live") {
      setBrokerMode("live");
    }
    await placeBrokerOrder(ticketForFusionPrediction(prediction), "live");
  }

  const topSell = sellLeaders[0];
  const staleStocks = signals.filter((signal) => !signal.dataFresh && signal.market === "Stock/ETF");
  const operationsSummary = trustSummary();
  const criticalGaps = criticalUnresolvedTrustGaps();
  const sortedTrustMatrix = sortedTrustGaps(trustOperationGaps);
  const proofCoveragePct = operationsSummary.proofCoveragePct;
  const sizing = selectedQuote
    ? calculatePositionSize({
        accountSize,
        riskPct: draft.risk,
        entry: selectedQuote.price,
        stop: topSignal?.symbol === selectedQuote.symbol ? topSignal.invalidation : selectedQuote.low,
        maxDailyLossPct,
      })
    : null;
  const journalStats = useMemo(() => {
    const count = journal.length;
    const avgConfidence = count
      ? Math.round(journal.reduce((sum, entry) => sum + entry.confidence, 0) / count)
      : 0;
    const avgRisk = count
      ? Number((journal.reduce((sum, entry) => sum + entry.risk, 0) / count).toFixed(2))
      : 0;
    return { count, avgConfidence, avgRisk };
  }, [journal]);
  const movers = quotes.filter((quote) => Math.abs(quote.changePct) > 0.4).length;
  const green = quotes.filter((quote) => quote.changePct >= 0).length;
  const feedQuality = selectedQuote?.quality ?? quotes[0]?.quality ?? "Offline";
  const secondsAgo = lastRefreshAt ? Math.max(0, Math.round((clockNow - lastRefreshAt.getTime()) / 1000)) : null;
  const staleCount = signals.filter((signal) => !signal.dataFresh).length;

  useEffect(() => {
    if (!notificationsOn || !topSignal || topSignal.action === "Hold/No Trade") return;
    const key = `${topSignal.symbol}-${topSignal.action}-${topSignal.generatedAt.slice(0, 16)}`;
    if (key === lastSignalAlertRef.current) return;
    lastSignalAlertRef.current = key;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${topSignal.action}: ${topSignal.symbol}`, {
        body: `${topSignal.reason} Price ${formatUsd(topSignal.price)}. Invalidation ${formatUsd(topSignal.invalidation)}.`,
      });
    }
  }, [notificationsOn, topSignal]);

  function addSymbol() {
    const clean = newSymbol.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (!clean || watchlist.includes(clean)) return;
    setWatchlist((current) => [clean, ...current].slice(0, 24));
    setSelected(clean);
    setDraft((current) => ({ ...current, symbol: clean }));
    setNewSymbol("");
  }

  async function saveJournal() {
    if (!draft.symbol || !draft.thesis || !draft.invalidation) return;
    const entry = {
      id: crypto.randomUUID(),
      ...draft,
      createdAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    };
    setJournal((current) => [
      entry,
      ...current,
    ]);
    try {
      const response = await fetch("/api/research-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: entry.symbol,
          noteType: "journal",
          title: entry.setup,
          body: `Thesis: ${entry.thesis}\n\nInvalidation: ${entry.invalidation}\n\nConfidence: ${entry.confidence}. Risk: ${entry.risk}%.`,
          tags: [entry.setup, "dashboard"],
          source: "dashboard",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.note) {
        setResearchNotes((current) => [payload.note, ...current].slice(0, 20));
        setBrokerMessage("Research note saved locally and to the database.");
      }
    } catch {
      setBrokerMessage("Research note saved locally; remote notes did not respond.");
    }
    setDraft((current) => ({ ...current, thesis: "", invalidation: "" }));
  }

  async function savePaperTrade(ticket: TradeTicket | null) {
    if (!ticket) return;
    const paperTrade = {
      symbol: ticket.symbol,
      side: ticket.side,
      entry: ticket.entry,
      stop: ticket.stop,
      target: ticket.target,
      units: ticket.units,
      maxLoss: ticket.maxLoss,
      status: "Watching" as const,
    };
    setPaperTrades((current) => [
      {
        id: crypto.randomUUID(),
        ...paperTrade,
        createdAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
      },
      ...current,
    ]);
    try {
      const [ticketResponse, paperResponse] = await Promise.all([
        fetch("/api/trade-ticket", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ticket }),
        }),
        fetch("/api/paper-trades", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(paperTrade),
        }),
      ]);
      if (ticketResponse.ok || paperResponse.ok) {
        setBrokerMessage(aitableStatus?.mirrorReady ? "Paper ticket saved locally and mirrored to AITable." : "Paper ticket saved locally and sent to storage.");
      }
    } catch {
      setBrokerMessage("Paper ticket saved locally; remote storage did not respond.");
    }
  }

  function exportWorkspace() {
    const payload = {
      exportedAt: new Date().toISOString(),
      watchlist,
      journal,
      paperTrades,
      selected,
      version: 1,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trading-intel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text) as {
      watchlist?: string[];
      journal?: JournalEntry[];
      paperTrades?: PaperTrade[];
      selected?: string;
    };
    if (Array.isArray(payload.watchlist)) {
      setWatchlist(payload.watchlist.map((symbol) => symbol.toUpperCase()).slice(0, 24));
    }
    if (Array.isArray(payload.journal)) {
      setJournal(payload.journal);
    }
    if (Array.isArray(payload.paperTrades)) {
      setPaperTrades(payload.paperTrades);
    }
    if (payload.selected) {
      setSelected(payload.selected.toUpperCase());
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsOn(permission === "granted");
  }

  const assistantContext: TradingAssistantDashboardContext = {
    asOf: new Date().toISOString(),
    selectedSymbol: selectedQuote?.symbol,
    provider,
    brokerMode,
    feedQuality,
    secondsAgo,
    topBuyDecision: predictionBrief(buyDecision),
    topSellDecision: predictionBrief(sellDecision),
    tradeTicket: tradeTicketBrief(ticketForFusionPrediction(buyDecision) ?? tradeTicket),
    buyNow: buyNowSignals.slice(0, 5).map(buyNowBrief),
    blockedBuyNow: blockedBuyNowSignals.slice(0, 5).map(blockedBuyNowBrief),
    buyLeads: visibleBuyLeads.slice(0, 5).map(buyLeadBrief),
    risk: riskStatus?.report
      ? {
          equity: riskStatus.report.equity,
          dailyPnl: riskStatus.report.dailyPnl,
          dailyPnlPct: riskStatus.report.dailyPnlPct,
          grossExposure: riskStatus.report.grossExposure,
          netExposure: riskStatus.report.netExposure,
          openOrdersNotional: riskStatus.report.openOrdersNotional,
          riskFlags: riskStatus.report.riskFlags,
        }
      : null,
    broker: brokerStatus
      ? {
          mode: brokerStatus.mode,
          orderPlacementReady: brokerStatus.orderPlacementReady,
          credentialsConfigured: brokerStatus.credentialsConfigured,
          liveTradingEnabled: brokerStatus.liveTradingEnabled,
          liveAckConfigured: brokerStatus.liveAckConfigured,
          missing: brokerStatus.missing,
          restrictions: brokerStatus.restrictions,
        }
      : null,
    modelPerformance: modelPerformance?.summary
      ? {
          summary: modelPerformance.summary,
          outcomes: modelPerformance.outcomes?.slice(0, 4) ?? [],
        }
      : null,
    orchestration: latestOrchestrationRun
      ? {
          status: latestOrchestrationRun.status,
          symbol: latestOrchestrationRun.decision.symbol,
          nextAction: latestOrchestrationRun.decision.nextAction,
          paperGate: latestOrchestrationRun.decision.paper.status,
          liveGate: latestOrchestrationRun.decision.live.status,
          riskApproved: latestOrchestrationRun.decision.live.riskApproved,
          blockers: latestOrchestrationRun.stages
            .filter((stage) => stage.status === "blocked" || stage.status === "warning")
            .map((stage) => stage.summary)
            .slice(0, 5),
          referenceChecklist: latestOrchestrationRun.governance.referenceChecklist,
        }
      : null,
    referenceReports: {
      total: integratedReferenceSummary.total,
      categories: integratedReferenceSummary.categories,
      appliedRules: integratedReferenceSummary.appliedRules.slice(0, 8),
    },
    news: news.slice(0, 6).map((item) => ({
      symbol: item.symbol,
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
    })),
  };

  async function askAssistant(questionOverride?: string) {
    const question = (questionOverride ?? assistantDraft).trim();
    if (!question || assistantLoading) return;
    const userMessage: AssistantChatMessage = {
      id: messageId("user"),
      role: "user",
      content: question.slice(0, 1600),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...assistantMessages, userMessage].slice(-12);
    setAssistantMessages(nextMessages);
    setAssistantDraft("");
    setAssistantError("");
    setAssistantLoading(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          context: assistantContext,
        }),
      });
      const payload = await response.json().catch(() => null) as AssistantChatApiResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Analyst chat did not return an answer.");
      }
      const assistantMessage: AssistantChatMessage = {
        id: messageId("assistant"),
        role: "assistant",
        content: payload.answer ?? "No answer returned.",
        createdAt: new Date().toISOString(),
        model: payload.model ?? payload.configuredModels?.primary ?? "gpt-5.2",
        source: payload.source,
        advisory: payload.advisory,
      };
      setAssistantMessages([...nextMessages, assistantMessage].slice(-20));
      setAssistantModelLabel(assistantMessage.model ?? "gpt-5.2");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyst chat request failed.";
      setAssistantError(message);
      const failureMessage: AssistantChatMessage = {
        id: messageId("assistant"),
        role: "assistant",
        content: "I could not reach the analyst chat route. The dashboard data is still intact; retry after the API check clears.",
        createdAt: new Date().toISOString(),
        model: "unavailable",
        source: "client-error",
        advisory: message,
      };
      setAssistantMessages([...nextMessages, failureMessage].slice(-20));
    } finally {
      setAssistantLoading(false);
    }
  }

  function clearAssistantChat() {
    setAssistantMessages([assistantWelcomeMessage]);
    setAssistantDraft("");
    setAssistantError("");
  }

  return (
    <QuoteHistoryContext.Provider value={quoteHistory}>
      <main className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <a
        href="#overview"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cyan-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        Skip to dashboard
      </a>
      <LiveTickerTape quotes={quotes} signals={signals} buyLeads={buyLeads} buyNow={buyNowSignals} secondsAgo={secondsAgo} />
      <section id="overview" className="scroll-mt-14 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--info)]">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--buy)] opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--buy)]" />
                </span>
                Trading command center
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                Live Trading Cockpit
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]" role="status" aria-live="polite">
                {secondsAgo === null ? "Waiting for quote refresh" : `Quotes ${secondsAgo}s old`} | {feedQuality} | limit orders only.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={refresh}
                disabled={loading}
                aria-busy={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-100 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Refreshing" : "Refresh"}
              </button>
              <button
                onClick={exportWorkspace}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => void importWorkspace(event.target.files?.[0])}
              />
            </div>
          </div>
          <DashboardJumpNav sections={dashboardSections} />
          <CommandStatusRail
            status={status}
            lastRefreshAt={lastRefreshAt}
            selected={selected}
            feedQuality={feedQuality}
            staleCount={staleCount}
            brokerStatus={brokerStatus}
            brokerMessage={brokerMessage}
          />
          <InvestmentGradeTruthPanel
            selectedQuote={selectedQuote}
            brokerStatus={brokerStatus}
            brokerOverview={brokerOverview}
            opsStatus={opsStatus}
            secondsAgo={secondsAgo}
          />
          <DecisionCockpitHero
            buyDecision={buyDecision}
            sellDecision={sellDecision}
            brokerStatus={brokerStatus}
            brokerMode={brokerMode}
            brokerOverview={brokerOverview}
            agentTrader={agentTrader}
            secondsAgo={secondsAgo}
            feedQuality={feedQuality}
            paperTradesCount={paperTrades.length}
            agentExecuting={agentExecuting}
            placingOrder={placingOrder}
            buyTicket={ticketForFusionPrediction(buyDecision) ?? tradeTicket}
            orchestrationRun={latestOrchestrationRun}
            orchestrationRunning={orchestrationRunning}
            onSelect={selectFusionDecision}
            onPaperDecision={(prediction) => void handleFusionPaperDecision(prediction)}
            onLiveDecision={(prediction) => void handleFusionLiveDecision(prediction)}
            onRunOrchestration={() => void runControlPlane()}
          />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Metric icon={Activity} label="Feed" value={status} />
            <Metric icon={TrendingUp} label="Market Scan" value={`${green}/${quotes.length || watchlist.length} green, ${movers} movers`} />
            <Metric icon={Gauge} label="Proof Coverage" value={`${proofCoveragePct}% live/partial`} />
            <Metric icon={BellRing} label="Signals" value={`${buyNowSignals.length} buy-now, ${activeBuyLeads.length} buy leads`} />
            <Metric icon={Sparkles} label="Fusion Alpha" value={topFusionPrediction ? `${topFusionPrediction.symbol} ${topFusionPrediction.score}/100` : "Loading"} />
            <Metric icon={Brain} label="Algorithm Council" value={topAlgorithmScore ? `${topAlgorithmScore.symbol} ${topAlgorithmScore.ensembleScore}/100` : "Loading"} />
            <Metric icon={ShieldCheck} label="Institutional Gates" value={institutionalGrade} />
            <Metric icon={ServerCog} label="Research Stack" value={researchStack ? `${researchStack.configured}/${researchStack.total} ${researchStack.grade}` : "Checking"} />
            <Metric icon={GitBranch} label="Control Plane" value={latestOrchestrationRun ? orchestrationStatusLabel(latestOrchestrationRun.status) : "No run"} />
          </div>
          <TrustReadinessStrip summary={operationsSummary} brokerStatus={brokerStatus} aitableStatus={aitableStatus} />
          <ProductionOpsStrip ops={opsStatus} risk={riskStatus} performance={modelPerformance} />
        </div>
      </section>

      <section id="actions" className="scroll-mt-14 border-b border-[var(--border)] bg-[#090d12]">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(20rem,0.85fr)]">
            <FastActionQueue
              buyNow={buyNowSignals}
              buyLead={topBuyLead}
              sellSignal={topSell}
              blocked={blockedBuyNowSignals}
              activeLeadCount={activeBuyLeads.length}
              sellCount={sellLeaders.length}
              secondsAgo={secondsAgo}
            />
            <FastExecutionPanel
              ticket={tradeTicket}
              status={brokerStatus}
              mode={brokerMode}
              message={brokerMessage}
              acknowledgement={executionAck}
              placing={placingOrder}
              onModeChange={changeBrokerMode}
              onAcknowledgementChange={setExecutionAck}
              onSavePaperTicket={() => void savePaperTrade(tradeTicket)}
              onPlaceOrder={() => void placeBrokerOrder(tradeTicket)}
            />
            <FastRiskPanel
              overview={brokerOverview}
              risk={riskStatus}
              status={brokerStatus}
              feedQuality={feedQuality}
              secondsAgo={secondsAgo}
              staleCount={staleStocks.length}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1800px] items-start gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-4">
          <Panel id="intelligence" className="order-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={Sparkles} title="Fusion Alpha Command" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Every mapped repo, research worker, factor family, rule signal, backtest, agent debate, and catalyst proxy is forced into one weighted buy/sell prediction.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                {fusionAlpha?.ok ? `Full run ${fusionAlpha.lookbackDays ?? lookback}D` : "Live proxy until full run"}
              </div>
            </div>
            <FusionAlphaPanel
              predictions={fusionPredictions}
              selected={selectedFusionPrediction}
              generatedAt={fusionAlpha?.generatedAt}
              error={fusionAlpha?.ok === false ? fusionAlpha.error : undefined}
              onSelect={(symbol) => {
                setSelected(symbol);
                setDraft((current) => ({ ...current, symbol }));
              }}
            />
          </Panel>

          <Panel className="order-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={Bot} title="AI Agent Trading" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Agents can submit paper orders when Alpaca paper execution is ready. Manual live orders go through the Broker Execution Rail.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                {agentTrader?.policy?.liveAutonomyAllowed ? "Live agent autonomy on" : "Manual live orders only"}
              </div>
            </div>
            <AgentTradingPanel
              agent={agentTrader}
              message={agentMessage}
              executing={agentExecuting}
              onRunPaperAgent={(symbol) => void runPaperAgent(symbol)}
            />
          </Panel>

          <Panel className="order-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={Brain} title="Algorithm Council" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  SEC fundamentals, accounting-quality checks, value, profitability, investment discipline, and quote momentum are scored together here.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                Model: {topAlgorithmScore?.modelVersion ?? "loading"}
              </div>
            </div>
            <AlgorithmCouncilPanel council={algorithmCouncil} />
          </Panel>

          <Panel className="order-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={ShieldCheck} title="Institutional Gates" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Proof, controls, worker readiness, and compliance boundary are checked here before the platform treats any signal as operationally trustworthy.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                {institutionalReadiness?.productionInstitutionalReady ? "Operational" : "Needs proof"}
              </div>
            </div>
            <InstitutionalReadinessPanel readiness={institutionalReadiness} />
          </Panel>

          <Panel className="order-9">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={ServerCog} title="Research Stack" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Paid providers turn on when credentials exist; public fallbacks and external worker hooks stay visible so missing licenses are not confused with live proof.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                {researchStack ? `${researchStack.criticalConfigured}/${researchStack.criticalTotal} critical` : "Checking"}
              </div>
            </div>
            <ResearchStackPanel stack={researchStack} autoResearch={autoResearch} />
          </Panel>

          <Panel className="order-10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={Brain} title="Ising Basket Optimizer" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Classical simulated annealing chooses the best basket of current buy leads under budget, risk, max-position, and overlap limits.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                API: /api/optimizer/ising
              </div>
            </div>
            <IsingBasketPanel basket={isingBasket} />
          </Panel>

          <Panel id="analyst-chat" className="order-11">
            <AssistantChatPanel
              messages={assistantMessages}
              draft={assistantDraft}
              loading={assistantLoading}
              error={assistantError}
              modelLabel={assistantModelLabel}
              onDraftChange={setAssistantDraft}
              onAsk={(question) => void askAssistant(question)}
              onClear={clearAssistantChat}
            />
          </Panel>

          <Panel id="leads" className="order-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={TrendingUp} title="Live Buy Leads" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  The closest buy candidates are ranked here even when no name is clean enough for an active buy watch.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                {activeBuyLeads.length} active leads
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {visibleBuyLeads.map((lead, index) => (
                <BuyLeadCard key={lead.symbol} lead={lead} rank={index + 1} />
              ))}
            </div>
          </Panel>

          <Panel className="order-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={ListOrdered} title="Live Buy / Sell Leaderboard" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Ranked by setup quality, confidence, reward/risk, and urgency. Use these as research prompts, not automatic orders.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                Polling every {monitorSeconds < 60 ? `${monitorSeconds}s` : `${monitorSeconds / 60}m`}
              </div>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <BuyLeadColumn leads={visibleBuyLeads} />
              <LeaderboardColumn title="Sell / Exit Watch" tone="red" signals={sellLeaders} empty="No sell/exit-watch setups are currently flagged." />
            </div>
          </Panel>

          <Panel id="operations" className="order-3">
            <SectionTitle icon={ServerCog} title="Always-On Trading OS" />
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ServerCog className="h-4 w-4 text-cyan-300" />
                  Background Monitor
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <StatusLine label="Vercel cron" value="Every 5 minutes" ready />
                  <StatusLine label="Cron secret" value="Configured" ready />
                  <StatusLine
                    label="Broker execution"
                    value={brokerStatus?.orderPlacementReady ? `${brokerStatus.mode.toUpperCase()} armed` : "Locked"}
                    ready={Boolean(brokerStatus?.orderPlacementReady)}
                  />
                  <StatusLine
                    label="AITable mirror"
                    value={aitableStatus?.mirrorReady ? "Ready" : "Locked"}
                    ready={Boolean(aitableStatus?.mirrorReady)}
                  />
                  <StatusLine label="Off-device alerts" value="Waiting on SMS/email/webhook keys" />
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Calculator className="h-4 w-4 text-cyan-300" />
                  Position Sizing
                </div>
                <div className="mt-3 grid gap-3">
                  <Slider label="Account $" value={accountSize} min={1000} max={250000} step={1000} onChange={setAccountSize} />
                  <Slider label="Max Daily Loss %" value={maxDailyLossPct} min={0.5} max={10} step={0.5} onChange={setMaxDailyLossPct} />
                  {sizing && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <MiniStat label="Shares" value={`${sizing.shares}`} tone={sizing.valid ? "green" : "red"} />
                      <MiniStat label="Risk $" value={formatUsd(sizing.riskDollars)} tone="amber" />
                      <MiniStat label="Notional" value={formatUsd(sizing.notional)} tone="plain" />
                      <MiniStat label="Max Day Loss" value={formatUsd(sizing.maxDailyLossDollars)} tone="red" />
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ClipboardList className="h-4 w-4 text-cyan-300" />
                  Paper Analytics
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="Notes" value={`${journalStats.count}`} tone="plain" />
                  <MiniStat label="Avg Conf" value={`${journalStats.avgConfidence}`} tone="blue" />
                  <MiniStat label="Avg Risk" value={`${journalStats.avgRisk}%`} tone="amber" />
                  <MiniStat label="Mode" value="Paper" tone="green" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Real P/L analytics unlock once paper trades are stored in a database or broker read-only sync is connected.
                </p>
              </div>
            </div>
          </Panel>

          <Panel id="risk" className="order-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={ShieldCheck} title="Trust Matrix" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  The biggest gap is not more tickers. It is proof: durable outcomes after slippage, fees, and different market conditions.
                </p>
              </div>
              <span className="rounded-sm border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
                {criticalGaps.length} critical issue{criticalGaps.length === 1 ? "" : "s"} open
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MiniStat label="Issue Status" value={`${operationsSummary.live}/${operationsSummary.total} live`} tone="green" />
              <MiniStat label="Open Proof" value={`${operationsSummary.unresolved}`} tone={operationsSummary.unresolved ? "amber" : "green"} />
              <MiniStat label="Critical Open" value={`${operationsSummary.criticalUnresolved}`} tone={operationsSummary.criticalUnresolved ? "red" : "green"} />
              <MiniStat label="Proof Ready" value={`${operationsSummary.proven}/${operationsSummary.total}`} tone={operationsSummary.proven === operationsSummary.total ? "green" : "blue"} />
              <MiniStat label="Proof Coverage" value={`${operationsSummary.proofCoveragePct}%`} tone={operationsSummary.proofCoveragePct >= 70 ? "green" : "amber"} />
            </div>
            <TrustOperationsTable gaps={sortedTrustMatrix} />
          </Panel>

          <Panel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <SectionTitle icon={BellRing} title="Market Signal Monitor" />
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  Polls stocks, commodity ETFs, commodity futures proxies, and crypto, then flags rule-based buy-watch or sell/exit-watch setups only when
                  independent day-trading rules agree. These are research alerts, not orders or personalized financial advice.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 60, 120, 300].map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => setMonitorSeconds(seconds)}
                    className={`h-9 rounded-md border px-3 text-sm font-semibold transition ${
                      monitorSeconds === seconds
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/60"
                    }`}
                  >
                    {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
                  </button>
                ))}
                <button
                  onClick={enableNotifications}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60"
                >
                  <Bell className="h-4 w-4" />
                  {notificationsOn ? "Alerts On" : "Enable Alerts"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {signals.slice(0, 6).map((signal) => (
                <SignalCard key={signal.symbol} signal={signal} />
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={FileText} title="Day Trading Playbook" />
            <p className="mt-1 text-sm leading-6 text-slate-400">
              The app now scores stocks and commodities against these rules before it surfaces a buy/sell-watch alert.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {dayTradingRules.map((rule) => (
                <div key={rule.name} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-white">{rule.name}</div>
                    <span className="rounded-sm bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">{rule.market}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{rule.purpose}</p>
                  <div className="mt-3 text-xs leading-5 text-emerald-200">Confirm: {rule.confirmation}</div>
                  <div className="mt-1 text-xs leading-5 text-amber-200">Avoid: {rule.avoidWhen}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle icon={Database} title="Data Feed Control" />
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="auto">Auto best available</option>
                <option value="alpaca">Alpaca if keys exist</option>
                <option value="nasdaq">Nasdaq public quote</option>
                <option value="cnbc">CNBC public quote</option>
                <option value="yahoo">Yahoo unofficial</option>
                <option value="binance">Binance crypto/public</option>
              </select>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QualityBadge label="Alpaca" value="Partial or SIP" ready={provider === "alpaca"} />
              <QualityBadge label="Nasdaq" value="Public real-time flag" ready={provider === "nasdaq" || provider === "auto"} />
              <QualityBadge label="CNBC" value="Public timestamped" ready={provider === "cnbc" || provider === "auto"} />
              <QualityBadge label="Yahoo" value="Unofficial pre/post" ready={provider === "yahoo" || provider === "auto"} />
              <QualityBadge label="Stooq" value="Delayed fallback" ready />
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <SectionTitle icon={LineChart} title="Market Radar" />
                <p className="mt-1 text-sm text-slate-400">
                  Delayed market data, scoring, and execution discipline in one fast view.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={newSymbol}
                  onChange={(event) => setNewSymbol(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addSymbol()}
                  placeholder="Add symbol"
                  className="h-10 w-32 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-cyan-400/0 transition focus:ring-2"
                />
                <button
                  onClick={addSymbol}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950 transition hover:bg-cyan-200"
                  title="Add symbol"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ranked.map((quote) => {
                const positive = quote.changePct >= 0;
                const cardSignal = signals.find((signal) => signal.symbol === quote.symbol);
                const cardLead = buyLeads.find((lead) => lead.symbol === quote.symbol);
                const cardBuyNow = buyNowSignals.find((signal) => signal.symbol === quote.symbol);
                const cardAction = cardSignal ? tickerAction(cardSignal, cardLead, cardBuyNow) : { label: "LOADING", className: "bg-slate-500/20 text-slate-300" };
                return (
                  <button
                    key={quote.symbol}
                    onClick={() => {
                      setSelected(quote.symbol);
                      setDraft((current) => ({ ...current, symbol: quote.symbol }));
                    }}
                    className={`rounded-md border p-3 text-left transition ${
                      selectedQuote?.symbol === quote.symbol
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{quote.symbol}</div>
                        <div className="truncate text-xs text-slate-400">{quote.name}</div>
                      </div>
                      <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${cardAction.className}`}>
                        {cardAction.label}
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="font-mono text-xl text-white">{formatUsd(quote.price)}</div>
                        <div className={positive ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
                          {positive ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
                          {positive ? "+" : ""}
                          {quote.changePct.toFixed(2)}%
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>Score</div>
                        <div className="font-mono text-sm text-slate-200">{scoreQuote(quote)}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-sm bg-black/20 px-2 py-1 text-xs text-slate-300">
                      {quote.quality} | {quote.source}
                    </div>
                    <SymbolSparkline symbol={quote.symbol} price={quote.price} changePct={quote.changePct} compact />
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-h-[280px] flex-1">
                <SectionTitle icon={BarChart3} title={`${selectedQuote?.symbol ?? "Watchlist"} Price Map`} />
                <div className="mt-4 h-64">
                  <PriceChart data={spark} />
                </div>
              </div>
              <div className="grid gap-3 lg:w-72">
                {selectedQuote && (
                  <>
                    <Signal label="Open" value={formatUsd(selectedQuote.open)} />
                    <Signal label="Range" value={`${formatUsd(selectedQuote.low)} - ${formatUsd(selectedQuote.high)}`} />
                    <Signal label="Volume" value={formatVolume(selectedQuote.volume)} />
                    <Signal label="Source" value={selectedQuote.source} />
                    <Signal label="Quality" value={selectedQuote.quality} />
                    {selectedQuote.marketStatus && <Signal label="Session" value={selectedQuote.marketStatus} />}
                    <Signal label="Updated" value={selectedQuote.updatedAt} />
                  </>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <SectionTitle icon={FlaskConical} title="Quant Lab" />
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  A phone-safe simulation layer plus a real Alpaca historical-bars test harness. Ideas should earn evidence before paper promotion.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[28rem]">
                <Slider label="Lookback Days" value={lookback} min={10} max={240} onChange={setLookback} />
                <Slider label="Risk Unit" value={backtestRisk} min={0.25} max={5} step={0.25} onChange={setBacktestRisk} />
                <button
                  onClick={() => void runRealBacktest()}
                  disabled={backtestRunning}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:col-span-2"
                >
                  <FlaskConical className={`h-4 w-4 ${backtestRunning ? "animate-spin" : ""}`} />
                  Run Real Backtest
                </button>
                <button
                  onClick={() => void runAutoResearch()}
                  disabled={autoResearchRunning}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:col-span-2"
                >
                  <Brain className={`h-4 w-4 ${autoResearchRunning ? "animate-spin" : ""}`} />
                  Run AutoResearch Lab
                </button>
                <button
                  onClick={() => void runTradingAgents()}
                  disabled={tradingAgentsRunning}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-blue-300/40 bg-blue-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:col-span-2"
                >
                  <Bot className={`h-4 w-4 ${tradingAgentsRunning ? "animate-spin" : ""}`} />
                  Run TradingAgents Debate
                </button>
                <button
                  onClick={() => void runFusionAlpha()}
                  disabled={fusionRunning}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-fuchsia-300/40 bg-fuchsia-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:col-span-2"
                >
                  <Sparkles className={`h-4 w-4 ${fusionRunning ? "animate-spin" : ""}`} />
                  Run Fusion Alpha
                </button>
                <button
                  onClick={() => void runControlPlane()}
                  disabled={orchestrationRunning}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-violet-300/40 bg-violet-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:col-span-2"
                >
                  <GitBranch className={`h-4 w-4 ${orchestrationRunning ? "animate-spin" : ""}`} />
                  Run Control Plane
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-white/10 bg-black/25 p-3 text-sm leading-6 text-slate-300" role="status">
              {quantMessage}
            </div>
            <RealBacktestPanel result={realBacktest} />
            <AutoResearchPanel result={autoResearch} />
            <TradingAgentsPanel result={tradingAgents} />
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              {strategies.map((strategy) => (
                <StrategyTile key={strategy.name} strategy={strategy} />
              ))}
            </div>
            {bestStrategy && (
              <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                Best current research candidate: <span className="font-semibold">{bestStrategy.name}</span> through{" "}
                <span className="font-semibold">{bestStrategy.repo}</span>. Treat this as a ranking signal, not a trade.
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle icon={Layers} title="Engine Fusion Map" />
            <p className="mt-1 text-sm leading-6 text-slate-400">
              This is now an active evidence map for {selectedFusionPrediction?.symbol ?? "the watchlist"}. Every repo contributes a weighted finding to Fusion Alpha; unavailable workers are marked as proxy or blocked rather than treated as decorative labels.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {engineCapabilities.map((engine) => (
                <EngineCard key={engine.repo} engine={engine} finding={selectedFusionPrediction?.engineFindings.find((item) => item.repo === engine.repo)} />
              ))}
            </div>
          </Panel>

          <Panel id="journal">
            <SectionTitle icon={ClipboardList} title="Paper Trade Journal" />
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={draft.symbol}
                    onChange={(event) => setDraft({ ...draft, symbol: event.target.value.toUpperCase() })}
                    className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <select
                    value={draft.setup}
                    onChange={(event) => setDraft({ ...draft, setup: event.target.value })}
                    className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option>Momentum pullback</option>
                    <option>Breakout retest</option>
                    <option>Mean reversion</option>
                    <option>Earnings reaction</option>
                    <option>Macro hedge</option>
                  </select>
                </div>
                <textarea
                  value={draft.thesis}
                  onChange={(event) => setDraft({ ...draft, thesis: event.target.value })}
                  placeholder="Thesis: what must be true?"
                  className="min-h-24 w-full rounded-md border border-white/10 bg-black/30 p-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <textarea
                  value={draft.invalidation}
                  onChange={(event) => setDraft({ ...draft, invalidation: event.target.value })}
                  placeholder="Invalidation: what proves you wrong?"
                  className="min-h-20 w-full rounded-md border border-white/10 bg-black/30 p-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Slider
                    label="Confidence"
                    value={draft.confidence}
                    min={1}
                    max={100}
                    onChange={(value) => setDraft({ ...draft, confidence: value })}
                  />
                  <Slider
                    label="Risk %"
                    value={draft.risk}
                    min={0}
                    max={5}
                    step={0.25}
                    onChange={(value) => setDraft({ ...draft, risk: value })}
                  />
                </div>
                <button
                  onClick={() => void saveJournal()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-300 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Research Note
                </button>
              </div>
              <div className="max-h-96 space-y-3 overflow-auto pr-1">
                {journal.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
                    Your notes will appear here. Keep this boring and disciplined.
                  </div>
                ) : (
                  journal.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{entry.symbol}</div>
                          <div className="text-xs text-slate-500">{entry.createdAt}</div>
                        </div>
                        <button
                          onClick={() => setJournal((current) => current.filter((item) => item.id !== entry.id))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:text-white"
                          title="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{entry.thesis}</div>
                      <div className="mt-2 text-xs text-rose-200">Invalidation: {entry.invalidation}</div>
                    </div>
                  ))
                )}
                {researchNotes.length > 0 && (
                  <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
                    <div className="text-sm font-semibold text-white">Database Notes</div>
                    <div className="mt-3 space-y-2">
                      {researchNotes.slice(0, 5).map((note) => (
                        <div key={note.id} className="rounded-sm bg-black/20 p-2 text-xs leading-5 text-slate-300">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-white">{note.symbol}</span>
                            <span className="text-cyan-200">{note.note_type}</span>
                          </div>
                          <div className="mt-1 font-semibold text-slate-100">{note.title}</div>
                          <div className="mt-1 line-clamp-2 text-slate-400">{note.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={FileText} title="Paper Tickets" />
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Saved tickets are simulated plans only. They create the audit trail needed before broker paper execution.
            </p>
            <PaperTradesTable trades={paperTrades} onRemove={(id) => setPaperTrades((current) => current.filter((trade) => trade.id !== id))} />
          </Panel>
        </div>

        <aside className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel>
            <SectionTitle icon={ListOrdered} title="Build Order" />
            <div className="mt-4 space-y-3">
              {trustBuildOrder.map((step, index) => (
                <div key={step.name} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/30 font-mono text-xs text-white">
                        {index + 1}
                      </span>
                      <div className="font-semibold text-white">{step.name}</div>
                    </div>
                    <StatusPill status={step.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={CalendarDays} title="Event Risk Calendar" />
            <div className="mt-4 space-y-3">
              {marketEvents.map((event) => (
                <div key={`${event.market}-${event.name}`} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{event.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{event.market} | {event.cadence}</div>
                    </div>
                    <span className="rounded-sm bg-amber-300/10 px-2 py-1 text-xs text-amber-200">{event.risk}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{event.check}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={ShieldCheck} title="Best Practices" />
            <div className="mt-4 space-y-3">
              {dayTradingBestPractices.map((practice) => (
                <div key={practice} className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-6 text-slate-300">{practice}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={Zap} title="Research Pipeline" />
            <div className="mt-4 space-y-3">
              {engineWorkflow.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-cyan-300 text-xs font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={Smartphone} title="Repo Features Added" />
            <div className="mt-4 grid gap-3">
              {quantPipelines.map((pipeline) => (
                <div key={pipeline.title} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <pipeline.icon className="h-4 w-4 text-cyan-300" />
                    <div className="font-semibold text-white">{pipeline.title}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{pipeline.repo}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pipeline.body}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={FileText} title="Reference Reports Applied" />
            <ReferenceReportsPanel />
          </Panel>

          <Panel>
            <SectionTitle icon={Brain} title="Intelligence Brief" />
            <div className="mt-4 grid gap-3">
              {macroSignals.map((signal) => (
                <div key={signal.label} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-sm text-slate-400">{signal.label}</span>
                  <span className="text-sm font-semibold text-white">{signal.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={Newspaper} title="Headlines" />
            <div className="mt-4 space-y-3">
              {news.length === 0 ? (
                <div className="rounded-md border border-white/10 p-3 text-sm text-slate-400">
                  Headlines are loading or temporarily unavailable.
                </div>
              ) : (
                news.slice(0, 8).map((item) => (
                  <a
                    key={`${item.symbol}-${item.link}`}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-300/60"
                  >
                    <div className="text-xs font-semibold text-cyan-300">{item.symbol}</div>
                    <div className="mt-1 text-sm text-white">{item.title}</div>
                    <div className="mt-2 text-xs text-slate-500">{item.source}</div>
                  </a>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={Bot} title="Agent Desk" />
            <div className="mt-4 space-y-3">
              {agents.map((agent) => (
                <div key={agent.name} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{agent.name}</div>
                    <span className="rounded-sm bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">{agent.role}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{agent.task}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={ShieldCheck} title="Risk Constitution" />
            <div className="mt-4 space-y-3">
              {playbooks.map((item) => (
                <div key={item} className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
      </main>
    </QuoteHistoryContext.Provider>
  );
}

function Panel({ children, id, className = "order-[20]" }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={`${className} min-w-0 scroll-mt-16 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20`}>
      {children}
    </div>
  );
}

function AssistantChatPanel({
  messages,
  draft,
  loading,
  error,
  modelLabel,
  onDraftChange,
  onAsk,
  onClear,
}: {
  messages: AssistantChatMessage[];
  draft: string;
  loading: boolean;
  error: string;
  modelLabel: string;
  onDraftChange: (value: string) => void;
  onAsk: (question?: string) => void;
  onClear: () => void;
}) {
  const canAsk = draft.trim().length > 0 && !loading;
  const help = "Ask questions that are not already surfaced in the dashboard. The assistant answers from current cockpit context, live ticket fields, risk state, orchestration runs, reference reports, and visible market data.";
  return (
    <div title={help} aria-label={help}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle icon={MessageSquare} title="Analyst Chat" />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Model: {modelLabel}</span>
            <HelpTip text={help} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-rose-300/40 hover:text-rose-100"
          title="Clear chat"
          aria-label="Clear analyst chat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 max-h-96 space-y-3 overflow-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-md border p-3 ${
              message.role === "user"
                ? "border-cyan-300/20 bg-cyan-300/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className={message.role === "user" ? "font-semibold text-cyan-100" : "font-semibold text-emerald-100"}>
                {message.role === "user" ? "You" : "Analyst"}
              </span>
              {message.role === "assistant" && message.model && (
                <span className="rounded-sm bg-black/25 px-2 py-1 font-mono text-xs text-slate-300">{message.model}</span>
              )}
            </div>
            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{message.content}</div>
            {message.advisory && <div className="mt-2 text-xs leading-5 text-amber-200">{message.advisory}</div>}
          </div>
        ))}
        {loading && (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
            Thinking through the current cockpit state...
          </div>
        )}
      </div>
      {error && <div className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {assistantQuickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={loading}
            onClick={() => onAsk(question)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-300/50 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white"
          >
            {question}
          </button>
        ))}
      </div>
      <form
        className="mt-4 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={1600}
          placeholder="Ask about risk, evidence, blockers, sizing, broker gates, or a symbol."
          className="min-h-24 w-full resize-none rounded-md border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
        />
        <button
          type="submit"
          disabled={!canAsk}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Send className="h-4 w-4" />
          Ask
        </button>
      </form>
    </div>
  );
}

function ReferenceReportsPanel() {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Reports" value={`${integratedReferenceSummary.total}`} tone="blue" />
        <MiniStat label="Research" value={`${integratedReferenceSummary.categories.research}`} tone="green" />
        <MiniStat label="Gates" value={`${integratedReferenceSummary.categories.execution + integratedReferenceSummary.categories.risk}`} tone="amber" />
      </div>
      <div className="max-h-80 divide-y divide-white/10 overflow-auto rounded-md border border-white/10">
        {referenceReportLessons.map((lesson) => (
          <div key={lesson.key} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-white">{lesson.title}</div>
              <span className="rounded-sm bg-black/30 px-2 py-1 text-xs uppercase text-cyan-200">{lesson.category}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{lesson.source}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{lesson.systemRule}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardJumpNav({ sections }: { sections: typeof dashboardSections }) {
  return (
    <nav aria-label="Dashboard sections" className="sticky top-11 z-30 -mx-4 border-y border-white/10 bg-[var(--surface)]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            title={`Jump to the ${section.label} section.`}
            aria-label={`Jump to the ${section.label} section.`}
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex shrink-0 items-center">
      <span
        role="note"
        aria-label={text}
        title={text}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-cyan-300/60 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-7 z-50 hidden w-72 -translate-x-1/2 rounded-md border border-white/10 bg-slate-950 p-3 text-xs leading-5 text-slate-200 shadow-xl shadow-black/50 group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

function ProvenanceBadge({ kind, label }: { kind: "live" | "derived" | "proxy" | "blocked"; label: string }) {
  const classes =
    kind === "live"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      : kind === "derived"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        : kind === "proxy"
          ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
          : "border-rose-300/25 bg-rose-300/10 text-rose-100";
  const help = provenanceExplanations[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-semibold ${classes}`} title={`${label}. ${help}`} aria-label={`${label}. ${help}`}>
      <span className="uppercase">{kind}</span>
      <span className="text-slate-300">{label}</span>
      <HelpTip text={help} />
    </span>
  );
}

function CommandStatusRail({
  status,
  lastRefreshAt,
  selected,
  feedQuality,
  staleCount,
  brokerStatus,
  brokerMessage,
}: {
  status: string;
  lastRefreshAt: Date | null;
  selected: string;
  feedQuality: string;
  staleCount: number;
  brokerStatus: BrokerStatus | null;
  brokerMessage: string;
}) {
  const brokerReady = Boolean(brokerStatus?.orderPlacementReady);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3" role="status" aria-live="polite">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <ProvenanceBadge kind="live" label="Quotes / broker / refresh are factual feeds" />
        <ProvenanceBadge kind="derived" label="Scores are app-derived research signals" />
        <ProvenanceBadge kind="proxy" label="Proxy means external proof is not connected" />
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
        <StatusLine label="System" value={status} ready={!status.toLowerCase().includes("issue") && !status.toLowerCase().includes("unavailable")} />
        <StatusLine label="Selected" value={selected} ready />
        <StatusLine label="Feed" value={`${feedQuality}${staleCount ? ` / ${staleCount} stale` : ""}`} ready={staleCount === 0} />
        <StatusLine label="Broker" value={brokerReady ? `${brokerStatus?.mode.toUpperCase()} armed` : "Locked"} ready={brokerReady} />
        <StatusLine label="Refresh" value={lastRefreshAt ? lastRefreshAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "Pending"} ready={Boolean(lastRefreshAt)} />
      </div>
      {!brokerReady && (
        <div className="mt-2 rounded-sm border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
          {brokerMessage}
        </div>
      )}
    </div>
  );
}

function InvestmentGradeTruthPanel({
  selectedQuote,
  brokerStatus,
  brokerOverview,
  opsStatus,
  secondsAgo,
}: {
  selectedQuote: Quote | undefined;
  brokerStatus: BrokerStatus | null;
  brokerOverview: BrokerOverview | null;
  opsStatus: OpsStatus | null;
  secondsAgo: number | null;
}) {
  const quoteInvestmentGrade = Boolean(
    selectedQuote &&
      selectedQuote.quality === "Execution Grade" &&
      selectedQuote.source !== "Offline fallback" &&
      secondsAgo !== null &&
      secondsAgo <= 2,
  );
  const brokerFactReady = Boolean(brokerStatus?.credentialsConfigured && brokerOverview?.ok);
  const licensedData = Boolean(opsStatus?.liveData?.licensedSip);
  const admittedFacts = [
    selectedQuote
      ? {
          label: "Selected quote",
          value: `${selectedQuote.symbol} ${formatUsd(selectedQuote.price)}`,
          source: selectedQuote.source,
          grade: quoteInvestmentGrade ? "admitted" : "rejected",
          reason: quoteInvestmentGrade
            ? "Execution-grade quote, fresh timestamp, provider source present."
            : `Not admitted: ${selectedQuote.quality}; investment grade requires licensed SIP/Polygon/Execution Grade and <=2s freshness.`,
        }
      : {
          label: "Selected quote",
          value: "Unavailable",
          source: "No current quote",
          grade: "rejected",
          reason: "No price can be investment-grade without a current sourced quote.",
        },
    {
      label: "Market-data entitlement",
      value: licensedData ? "Licensed" : "Not licensed",
      source: "Ops status",
      grade: licensedData ? "admitted" : "rejected",
      reason: licensedData
        ? "Ops reports SIP/paid market-data entitlement."
        : "Public, IEX-only, delayed, unofficial, or fallback feeds are research-only.",
    },
    {
      label: "Broker rail",
      value: brokerFactReady ? `${brokerStatus?.mode.toUpperCase()} verified` : "Not verified",
      source: "Broker API readiness",
      grade: brokerFactReady ? "admitted" : "rejected",
      reason: brokerFactReady
        ? "Broker API responded and credentials are configured."
        : "Broker facts require a successful authenticated broker API response.",
    },
  ] satisfies Array<{ label: string; value: string; source: string; grade: "admitted" | "rejected"; reason: string }>;
  const admittedCount = admittedFacts.filter((fact) => fact.grade === "admitted").length;

  return (
    <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
            <h2 className="text-lg font-semibold text-white">Investment-Grade Truth Gate</h2>
            <HelpTip text="Only externally sourced, timestamped, licensed or official facts are admitted here. Model scores, proxy lanes, forecasts, and generated recommendations are excluded from investment-grade truth." />
          </div>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-amber-50">
            {admittedCount}/3 facts admitted. Trading signals remain research-only unless every relevant fact is sourced, fresh, licensed or official, and independently verifiable.
          </p>
        </div>
        <span className="rounded-sm border border-amber-200/30 bg-black/25 px-3 py-2 text-xs font-semibold uppercase text-amber-100">
          Ultra-truth mode
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {admittedFacts.map((fact) => (
          <div key={fact.label} className="rounded-md border border-white/10 bg-black/20 p-3" title={fact.reason} aria-label={`${fact.label}. ${fact.value}. ${fact.reason}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                <span className="truncate">{fact.label}</span>
                <HelpTip text={fact.reason} />
              </div>
              <span className={`shrink-0 rounded-sm px-2 py-1 text-xs font-bold uppercase ${fact.grade === "admitted" ? "bg-emerald-300 text-slate-950" : "bg-rose-300/20 text-rose-100"}`}>
                {fact.grade}
              </span>
            </div>
            <div className="mt-2 truncate font-mono text-base text-white">{fact.value}</div>
            <div className="mt-1 truncate text-xs text-slate-400">Source: {fact.source}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
        Excluded from investment-grade truth: Fusion score, Evidence Confidence, buy/sell decisions, forecasts, proxy engine lanes, public quote composites, unofficial feeds, and any value without source provenance.
      </div>
    </div>
  );
}

function DecisionCockpitHero({
  buyDecision,
  sellDecision,
  brokerStatus,
  brokerMode,
  brokerOverview,
  agentTrader,
  secondsAgo,
  feedQuality,
  paperTradesCount,
  agentExecuting,
  placingOrder,
  buyTicket,
  orchestrationRun,
  orchestrationRunning,
  onSelect,
  onPaperDecision,
  onLiveDecision,
  onRunOrchestration,
}: {
  buyDecision: FusionPrediction | undefined;
  sellDecision: FusionPrediction | undefined;
  brokerStatus: BrokerStatus | null;
  brokerMode: BrokerMode;
  brokerOverview: BrokerOverview | null;
  agentTrader: AgentTraderApi | null;
  secondsAgo: number | null;
  feedQuality: string;
  paperTradesCount: number;
  agentExecuting: boolean;
  placingOrder: boolean;
  buyTicket: TradeTicket | null;
  orchestrationRun: OrchestrationRun | null;
  orchestrationRunning: boolean;
  onSelect: (prediction: FusionPrediction | undefined) => void;
  onPaperDecision: (prediction: FusionPrediction | undefined) => void;
  onLiveDecision: (prediction: FusionPrediction | undefined) => void;
  onRunOrchestration: () => void;
}) {
  const canBuy = Boolean(buyDecision && buyDecision.direction === "buy" && buyDecision.action !== "Data Review");
  const paperReady = Boolean(agentTrader?.policy?.paperAutomationReady || (brokerStatus?.mode === "paper" && brokerStatus.orderPlacementReady));
  const liveConfigured = Boolean(brokerStatus?.credentialsConfigured && brokerStatus.liveTradingEnabled && brokerStatus.liveAckConfigured);
  const liveReady = Boolean(brokerMode === "live" ? brokerStatus?.orderPlacementReady : liveConfigured);
  const quoteAge = secondsAgo === null ? "Waiting" : `${secondsAgo}s`;
  const orchestrationTone = orchestrationRun
    ? orchestrationRun.status === "ready-for-paper"
      ? "green"
      : orchestrationRun.status === "blocked"
        ? "red"
        : orchestrationRun.status === "no-action"
          ? "plain"
          : "amber"
    : "amber";

  return (
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-2">
      <HeroDecisionCard
        intent="buy"
        prediction={buyDecision}
        ticket={buyTicket}
        primary
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => onPaperDecision(buyDecision)}
              disabled={!canBuy || agentExecuting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--buy)] px-4 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Bot className="h-4 w-4" />
              {agentExecuting ? "Paper Running" : "Paper Trade"}
            </button>
            <button
              onClick={() => onLiveDecision(buyDecision)}
              disabled={!canBuy || placingOrder}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-rose-300 px-4 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Zap className="h-4 w-4" />
              {placingOrder ? "Submitting" : "Live Buy"}
            </button>
          </div>
        }
      />

      <HeroDecisionCard
        intent="sell"
        prediction={sellDecision}
        footer={
          <button
            onClick={() => onSelect(sellDecision)}
            disabled={!sellDecision}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-rose-300/35 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 transition hover:border-rose-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            <TrendingDown className="h-4 w-4" />
            Review Sell / Avoid
          </button>
        }
      />

      <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3 xl:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ReadinessCell
            label="Paper"
            value={paperReady ? "Ready" : "Gated"}
            detail={`${paperTradesCount} saved watches`}
            tone={paperReady ? "green" : "amber"}
          />
          <ReadinessCell
            label="Live"
            value={liveReady ? "Ready" : "Gated"}
            detail={`${brokerMode.toUpperCase()} rail`}
            tone={liveReady ? "green" : "red"}
          />
          <ReadinessCell
            label="Feed"
            value={feedQuality}
            detail={`Age ${quoteAge}`}
            tone={feedQuality === "Execution Grade" || feedQuality === "Public Real-Time" ? "green" : "amber"}
          />
          <ReadinessCell
            label="Exposure"
            value={`${brokerOverview?.positions?.length ?? 0} positions`}
            detail={`${brokerOverview?.orders?.length ?? 0} open orders`}
            tone={(brokerOverview?.positions?.length ?? 0) > 0 ? "blue" : "plain"}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-1 text-xs text-slate-300 sm:grid-cols-3">
            {(orchestrationRun?.stages ?? []).slice(0, 6).map((stage) => (
              <div key={stage.key} className="flex min-w-0 items-center gap-2 rounded-sm bg-white/[0.03] px-2 py-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${stageDotClass(stage.status)}`} />
                <span className="truncate">{stage.label}</span>
              </div>
            ))}
            {!orchestrationRun && <div className="rounded-sm bg-white/[0.03] px-2 py-1 text-slate-400">No chain run yet</div>}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <ReadinessCell
              label="Control Plane"
              value={orchestrationRun ? orchestrationStatusLabel(orchestrationRun.status) : "No run"}
              detail={orchestrationRun ? `${orchestrationRun.decision.symbol ?? "watchlist"} / live ${gateLabel(orchestrationRun.decision.live.status)}` : "watchlist"}
              tone={orchestrationTone}
            />
            <button
              onClick={onRunOrchestration}
              disabled={orchestrationRunning}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-violet-300/35 bg-violet-300/10 px-3 text-sm font-semibold text-violet-100 transition hover:border-violet-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            >
              <GitBranch className={`h-4 w-4 ${orchestrationRunning ? "animate-spin" : ""}`} />
              {orchestrationRunning ? "Running" : "Run Chain"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroDecisionCard({
  intent,
  prediction,
  ticket = null,
  primary = false,
  footer,
}: {
  intent: "buy" | "sell";
  prediction: FusionPrediction | undefined;
  ticket?: TradeTicket | null;
  primary?: boolean;
  footer: React.ReactNode;
}) {
  if (!prediction) {
    return (
      <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
        Waiting for Fusion Alpha.
      </div>
    );
  }

  const headline = decisionHeadline(prediction, intent);
  const intentLabel = intent === "buy" ? "Best Buy Decision" : "Sell / Avoid Decision";
  const forecastAvailable = prediction.forecast.units > 0 && prediction.forecast.projectedPnl !== 0;
  const forecastLabel = prediction.direction === "sell" ? "Avoided downside" : "Forecast P/L";
  const actionClass = fusionActionClass(prediction.action);
  const supports = prediction.topSupports.length ? prediction.topSupports : prediction.engineFindings.filter((finding) => finding.impact === "supports").slice(0, 2);
  const challenges =
    prediction.blockers.length > 0
      ? prediction.blockers
      : prediction.topChallenges.length > 0
        ? prediction.topChallenges.map((finding) => finding.finding)
        : ["No major blocker in current fusion view."];
  const shell =
    intent === "buy"
      ? "border-emerald-300/25 bg-[linear-gradient(135deg,rgba(45,212,163,0.13),rgba(18,24,32,0.94))]"
      : "border-rose-300/25 bg-[linear-gradient(135deg,rgba(255,92,122,0.12),rgba(18,24,32,0.94))]";
  const chartPrice = ticket?.entry || prediction.entry || prediction.target || prediction.stop || 0;

  return (
    <div className={`flex h-full min-w-0 flex-col rounded-md border p-4 shadow-sm shadow-black/30 ${shell}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 text-xs font-bold uppercase text-slate-500">{intentLabel}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${actionClass}`}>{prediction.action}</span>
            <span className="rounded-sm border border-white/10 bg-black/25 px-2 py-1 text-xs font-semibold text-slate-300">{decisionWindowLabel(prediction)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className={`font-mono font-semibold text-white ${primary ? "text-5xl" : "text-3xl"}`}>{prediction.symbol}</span>
            <span className={`pb-1 font-semibold uppercase ${intent === "buy" ? "text-emerald-200" : "text-rose-200"}`}>{headline}</span>
          </div>
          <p className={`mt-3 text-sm leading-6 ${primary ? "max-w-4xl text-slate-200" : "text-slate-300"}`}>{prediction.thesis}</p>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-xs sm:w-64 sm:shrink-0">
          <MiniStat label="Model Score" value={`${prediction.score}/100`} tone={prediction.score >= 65 ? "green" : prediction.score <= 44 ? "red" : "amber"} />
          <MiniStat label="Evidence Confidence" value={`${prediction.confidence}/100`} tone={prediction.confidence >= 70 ? "green" : "blue"} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <ProvenanceBadge kind="derived" label="Fusion output" />
        {prediction.engineFindings.some((finding) => finding.status === "proxy") && <ProvenanceBadge kind="proxy" label="Some engine lanes are approximations" />}
        {prediction.blockers.length > 0 && <ProvenanceBadge kind="blocked" label="Action blocked by risk/data checks" />}
      </div>

      <SymbolSparkline symbol={prediction.symbol} price={chartPrice} compact={!primary} />

      {primary && <div className="mt-4">{footer}</div>}

      <div className={`mt-4 grid grid-cols-2 gap-2 text-xs ${primary ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <MiniStat label="Timeframe" value={decisionWindowLabel(prediction)} tone="amber" />
        <MiniStat label="Expected Hold" value={prediction.expectedHold} tone="blue" />
        <MiniStat label="Max Hold" value={prediction.maxHold} tone="plain" />
        <MiniStat label={forecastLabel} value={forecastAvailable ? formatSignedUsd(prediction.forecast.projectedPnl) : "No forecast"} tone={prediction.forecast.projectedPnl >= 0 ? "green" : "red"} />
        <MiniStat label="Move" value={forecastAvailable ? formatSignedPct(prediction.forecast.expectedMovePct) : "N/A"} tone={prediction.forecast.expectedMovePct >= 0 ? "green" : "red"} />
        <MiniStat label="Max Loss" value={prediction.forecast.maxLoss > 0 ? formatUsd(prediction.forecast.maxLoss) : "N/A"} tone="red" />
      </div>

      {primary && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <MiniStat label="Trigger" value={ticket ? formatUsd(ticket.trigger) : prediction.entry ? formatUsd(prediction.entry) : "No trigger"} tone="green" />
          <MiniStat label="Stop" value={ticket ? formatUsd(ticket.stop) : prediction.stop ? formatUsd(prediction.stop) : "No stop"} tone="amber" />
          <MiniStat label="Target" value={ticket ? formatUsd(ticket.target) : prediction.target ? formatUsd(prediction.target) : "No target"} tone="blue" />
          <MiniStat label="Position Size" value={ticket?.positionSize ?? (prediction.forecast.units > 0 ? `${prediction.forecast.units} / ${formatUsd(prediction.forecast.notional)}` : "N/A")} tone="plain" />
        </div>
      )}

      {primary && <LiveTradeBrief ticket={ticket} prediction={prediction} />}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-sm bg-black/20 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Best Evidence</div>
          <div className="mt-2 space-y-1 text-xs leading-5 text-emerald-100">
            {supports.slice(0, primary ? 3 : 2).map((finding) => (
              <div key={finding.key}>{finding.label}: {finding.score}/100</div>
            ))}
          </div>
        </div>
        <div className="rounded-sm bg-black/20 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Risk Check</div>
          <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100">
            {challenges.slice(0, primary ? 3 : 2).map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      </div>

      {!primary && <div className="mt-auto pt-4">{footer}</div>}
    </div>
  );
}

function LiveTradeBrief({
  ticket,
  prediction,
}: {
  ticket: TradeTicket | null;
  prediction: FusionPrediction;
}) {
  const entrySignal = ticket?.entrySignalNeeded ?? prediction.operatorAction;
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Entry Signal Needed" value={entrySignal} tone={prediction.direction === "buy" ? "green" : "amber"} />
        <MiniStat label="Risk/Reward" value={`${ticket?.riskRewardRatio ?? prediction.rewardRisk ?? 0}R`} tone={(ticket?.riskRewardRatio ?? prediction.rewardRisk ?? 0) >= 1.5 ? "green" : "red"} />
        <MiniStat label="Potential Size" value={ticket ? `${ticket.potentialUnits} units / ${formatUsd(ticket.potentialNotional)}` : "N/A"} tone="blue" />
        <MiniStat label="Suggested Size" value={ticket?.suggestedPositionSize ?? "No suggested size until ticket is valid."} tone={ticket?.tradeable ? "green" : "amber"} />
      </div>
    </div>
  );
}

function ReadinessCell({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "red" | "amber" | "blue" | "plain";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-rose-300"
        : tone === "amber"
          ? "text-amber-300"
          : tone === "blue"
            ? "text-cyan-300"
            : "text-white";
  const help = statusExplanations[label] ?? statExplanations[label] ?? `${label}: ${value}. ${detail}`;
  return (
    <div className="rounded-sm bg-white/[0.03] p-3" title={help} aria-label={`${label}. ${value}. ${detail}. ${help}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
        {label}
        <HelpTip text={help} />
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </div>
  );
}

function decisionHeadline(prediction: FusionPrediction, intent: "buy" | "sell") {
  if (intent === "buy" && prediction.direction !== "buy") return "NO BUY NOW";
  if (prediction.direction === "buy") return "BUY";
  if (prediction.direction === "sell") return "SELL / AVOID";
  if (prediction.direction === "review") return "DATA REVIEW";
  return "HOLD";
}

function decisionWindowLabel(prediction: FusionPrediction) {
  const text = `${prediction.horizon} ${prediction.expectedHold} ${prediction.maxHold}`.toLowerCase();
  if (text.includes("intraday") || text.includes("same-session") || text.includes("day trade")) return "Intraday";
  if (text.includes("1-5") || text.includes("5 trading") || text.includes("one trading day")) return "1 week";
  if (text.includes("1-4 weeks") || text.includes("month")) return "1 month";
  if (text.includes("quarter")) return "1 quarter";
  if (text.includes("year") || text.includes("long-term")) return "1 year";
  return prediction.horizon;
}

function orchestrationStatusLabel(status: OrchestrationRun["status"]) {
  if (status === "ready-for-paper") return "Paper ready";
  if (status === "needs-review") return "Needs review";
  if (status === "no-action") return "No action";
  return "Blocked";
}

function gateLabel(status: OrchestrationRun["decision"]["live"]["status"]) {
  if (status === "ready") return "Ready";
  if (status === "approval-required") return "Manual";
  if (status === "skipped") return "Skipped";
  return "Blocked";
}

function stageDotClass(status: OrchestrationRun["stages"][number]["status"]) {
  if (status === "passed") return "bg-emerald-300";
  if (status === "warning") return "bg-amber-300";
  if (status === "skipped") return "bg-slate-500";
  return "bg-rose-300";
}

function TrustReadinessStrip({
  summary,
  brokerStatus,
  aitableStatus,
}: {
  summary: ReturnType<typeof trustSummary>;
  brokerStatus: BrokerStatus | null;
  aitableStatus: AitableStatus | null;
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm sm:grid-cols-5">
      <StatusLine label="Trade ticket" value="Live" ready />
      <StatusLine label="Proof systems" value={`${summary.proven} proven / ${summary.partial} partial`} ready={summary.proven > 0} />
      <StatusLine label="Critical issues" value={`${summary.criticalUnresolved} open`} ready={summary.criticalUnresolved === 0} />
      <StatusLine
        label="Broker rail"
        value={brokerStatus?.orderPlacementReady ? `${brokerStatus.mode.toUpperCase()} armed` : "Locked"}
        ready={Boolean(brokerStatus?.orderPlacementReady)}
      />
      <StatusLine label="AITable mirror" value={aitableStatus?.mirrorReady ? "Ready" : "Locked"} ready={Boolean(aitableStatus?.mirrorReady)} />
    </div>
  );
}

function ProductionOpsStrip({
  ops,
  risk,
  performance,
}: {
  ops: OpsStatus | null;
  risk: RiskApiResponse | null;
  performance: ModelPerformanceApi | null;
}) {
  const readyCount = ops?.capabilities.filter((capability) => capability.ready).length ?? 0;
  const totalCount = ops?.capabilities.length ?? 0;
  const outcomes = performance?.outcomes ?? [];
  const bestOutcome = outcomes.find((item) => item.count > 0);
  const riskFlags = risk?.report?.riskFlags ?? [];

  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm md:grid-cols-2 xl:grid-cols-5">
      <StatusLine
        label="Production core"
        value={ops?.productionReadyCore ? "Ready" : ops ? "Partial" : "Checking"}
        ready={Boolean(ops?.productionReadyCore)}
      />
      <StatusLine label="Capabilities" value={totalCount ? `${readyCount}/${totalCount} active` : "Checking"} ready={readyCount >= 7} />
      <StatusLine
        label="Broker risk"
        value={risk?.ok ? `${riskFlags.length} flag(s)` : "Checking"}
        ready={Boolean(risk?.ok && riskFlags.length <= 1)}
      />
      <StatusLine
        label="Signal proof"
        value={bestOutcome ? `${bestOutcome.horizon} ${bestOutcome.count} checks` : `${performance?.summary?.total_signals ?? 0} signals`}
        ready={Boolean(bestOutcome)}
      />
      <StatusLine
        label="Data license"
        value={ops?.liveData?.licensedSip ? "SIP/paid" : ops?.liveData?.alpacaConfigured ? "IEX/public" : "Public only"}
        ready={Boolean(ops?.liveData?.licensedSip)}
      />
    </div>
  );
}

function FastActionQueue({
  buyNow,
  buyLead,
  sellSignal,
  blocked,
  activeLeadCount,
  sellCount,
  secondsAgo,
}: {
  buyNow: BuyNowSignal[];
  buyLead: BuyLead | undefined;
  sellSignal: TradeSignal | undefined;
  blocked: BlockedBuyNowSignal[];
  activeLeadCount: number;
  sellCount: number;
  secondsAgo: number | null;
}) {
  const primaryBuyNow = buyNow[0];
  const primaryBlocked = blocked.slice(0, 3);

  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle icon={Zap} title="Action Queue" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <MiniStat label="Buy now" value={`${buyNow.length}`} tone={buyNow.length ? "green" : "amber"} />
          <MiniStat label="Buy leads" value={`${activeLeadCount}`} tone={activeLeadCount ? "blue" : "plain"} />
          <MiniStat label="Sell watch" value={`${sellCount}`} tone={sellCount ? "red" : "plain"} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {primaryBuyNow ? (
          <button
            onClick={() => selectSignalSymbol(primaryBuyNow.symbol)}
            className="w-full rounded-md border border-emerald-300/40 bg-emerald-300/10 p-3 text-left transition hover:border-emerald-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm bg-emerald-300 px-2 py-1 text-xs font-black uppercase text-slate-950">Buy now</span>
                <span className="font-mono text-2xl font-semibold text-white">{primaryBuyNow.symbol}</span>
                <span className="text-sm text-slate-300">{primaryBuyNow.name}</span>
              </div>
              <span className="font-mono text-sm text-emerald-200">Trust {primaryBuyNow.confidence}</span>
            </div>
            <SymbolSparkline symbol={primaryBuyNow.symbol} price={primaryBuyNow.price} compact />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-5">
              <MiniStat label="Now" value={formatUsd(primaryBuyNow.price)} tone="plain" />
              <MiniStat label="Trigger" value={formatUsd(primaryBuyNow.trigger)} tone="green" />
              <MiniStat label="Stop" value={formatUsd(primaryBuyNow.stop)} tone="amber" />
              <MiniStat label="Target" value={formatUsd(primaryBuyNow.target)} tone="blue" />
              <MiniStat label="R/R" value={`${primaryBuyNow.riskRewardRatio}R`} tone={primaryBuyNow.riskRewardRatio >= 1.5 ? "green" : "red"} />
              <MiniStat label="Potential Size" value={`${primaryBuyNow.potentialUnits} / ${formatUsd(primaryBuyNow.potentialNotional)}`} tone="blue" />
              <MiniStat label="Position Size" value={primaryBuyNow.positionSize} tone="plain" />
              <MiniStat label="Strategy Minds" value={mindsetLabel(primaryBuyNow.strategyMindset)} tone={mindsetTone(primaryBuyNow.strategyMindset.stance)} />
              <MiniStat label="Entry Signal" value={primaryBuyNow.entrySignalNeeded} tone="green" />
              <MiniStat label="Hold" value={primaryBuyNow.expectedHold} tone="amber" />
            </div>
          </button>
        ) : (
          <button
            onClick={() => buyLead && selectSignalSymbol(buyLead.symbol)}
            disabled={!buyLead}
            className="w-full rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-left transition hover:border-cyan-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm bg-cyan-300 px-2 py-1 text-xs font-black uppercase text-slate-950">Best buy lead</span>
                <span className="font-mono text-2xl font-semibold text-white">{buyLead?.symbol ?? "None"}</span>
              </div>
              <span className="text-xs text-slate-400">{secondsAgo === null ? "waiting" : `${secondsAgo}s old`}</span>
            </div>
            {buyLead ? (
              <>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-cyan-100">{buyLead.reason}</p>
                <SymbolSparkline symbol={buyLead.symbol} price={buyLead.price} changePct={buyLead.moveFromOpenPct} compact />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-5">
                  <MiniStat label="Now" value={formatUsd(buyLead.price)} tone="plain" />
                  <MiniStat label="Trigger" value={formatUsd(buyLead.trigger)} tone="green" />
                  <MiniStat label="Stop" value={formatUsd(buyLead.stop)} tone="amber" />
                  <MiniStat label="Target" value={formatUsd(buyLead.target)} tone="blue" />
                  <MiniStat label="R/R" value={`${buyLead.rewardRisk}R`} tone={buyLead.rewardRisk >= 1.5 ? "green" : "red"} />
                  <MiniStat label="Score" value={`${buyLead.confidence}`} tone={buyLead.confidence >= 60 ? "green" : "blue"} />
                  <MiniStat label="Strategy Minds" value={mindsetLabel(buyLead.strategyMindset)} tone={mindsetTone(buyLead.strategyMindset.stance)} />
                  <MiniStat label="Hold" value={buyLead.holdingPeriod.expectedHold} tone="amber" />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-400">Waiting for a fresh enough lead.</p>
            )}
          </button>
        )}

        <button
          onClick={() => sellSignal && selectSignalSymbol(sellSignal.symbol)}
          disabled={!sellSignal}
          className="w-full rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-left transition hover:border-rose-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-rose-300 px-2 py-1 text-xs font-black uppercase text-slate-950">Sell / avoid</span>
              <span className="font-mono text-xl font-semibold text-white">{sellSignal?.symbol ?? "None"}</span>
            </div>
            <span className="font-mono text-sm text-rose-100">{sellSignal ? formatUsd(sellSignal.price) : "No flag"}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-rose-100">
            {sellSignal?.reason ?? "No sell/exit-watch setup is currently strong enough."}
          </p>
          {sellSignal && <SymbolSparkline symbol={sellSignal.symbol} price={sellSignal.price} compact />}
          {sellSignal && (
            <div className="mt-3 text-xs text-rose-100">
              Horizon: {sellSignal.holdingPeriod.expectedHold}
            </div>
          )}
        </button>

        <div className="overflow-hidden rounded-md border border-white/10">
          <div className="border-b border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
            Closest blocked names
          </div>
          <div className="divide-y divide-white/10">
            {primaryBlocked.length ? (
              primaryBlocked.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => selectSignalSymbol(item.symbol)}
                  className="grid w-full grid-cols-[2rem_1fr_auto] gap-3 px-3 py-2 text-left text-sm transition hover:bg-white/[0.04]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/30 font-mono text-xs text-white">{item.rank}</span>
                  <span className="min-w-0">
                    <span className="font-semibold text-white">{item.symbol}</span>
                    <span className="ml-2 inline-block max-w-[12rem] truncate align-bottom text-xs text-amber-100 sm:max-w-[18rem]">{item.blockers[0] ?? "Waiting for trigger"}</span>
                    <SymbolSparkline symbol={item.symbol} price={item.price} compact />
                  </span>
                  <span className="font-mono text-xs text-slate-300">{formatUsd(item.trigger)}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-slate-400">No blocked names yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FastExecutionPanel({
  ticket,
  status,
  mode,
  message,
  acknowledgement,
  placing,
  onModeChange,
  onAcknowledgementChange,
  onSavePaperTicket,
  onPlaceOrder,
}: {
  ticket: TradeTicket | null;
  status: BrokerStatus | null;
  mode: BrokerMode;
  message: string;
  acknowledgement: string;
  placing: boolean;
  onModeChange: (mode: BrokerMode) => void;
  onAcknowledgementChange: (value: string) => void;
  onSavePaperTicket: () => void;
  onPlaceOrder: () => void;
}) {
  const live = mode === "live";
  const disabled = !status?.orderPlacementReady || !ticket?.tradeable || placing || (live && acknowledgement.trim().length === 0);

  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle icon={Calculator} title="Ticket And Execute" />
        </div>
        <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${status?.orderPlacementReady ? "bg-emerald-300 text-slate-950" : "bg-amber-300/20 text-amber-100"}`}>
          {status?.orderPlacementReady ? `${mode} armed` : "locked"}
        </span>
      </div>

      <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-5 text-slate-300">
        {message}
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-[var(--surface-raised)] p-3">
        {ticket ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-3xl font-semibold text-white">{ticket.symbol}</span>
                  <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${ticket.tradeable ? "bg-[var(--buy)] text-slate-950" : "bg-[var(--wait-soft)] text-[var(--wait)]"}`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{ticket.reason}</p>
              </div>
              <MiniStat label="Mode" value={mode.toUpperCase()} tone={live ? "red" : "blue"} />
            </div>
            <SymbolSparkline symbol={ticket.symbol} price={ticket.entry} compact />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-4">
              <MiniStat label="Trigger" value={formatUsd(ticket.trigger)} tone="green" />
              <MiniStat label="Stop" value={formatUsd(ticket.stop)} tone="amber" />
              <MiniStat label="Target" value={formatUsd(ticket.target)} tone="blue" />
              <MiniStat label="R/R" value={`${ticket.riskRewardRatio}R`} tone={ticket.riskRewardRatio >= 1.5 ? "green" : "red"} />
              <MiniStat label="Potential Size" value={`${ticket.potentialUnits} / ${formatUsd(ticket.potentialNotional)}`} tone="blue" />
              <MiniStat label="Position Size" value={ticket.positionSize} tone="plain" />
              <MiniStat label="Suggested Size" value={ticket.suggestedPositionSize} tone={ticket.tradeable ? "green" : "amber"} />
              <MiniStat label="Max loss" value={formatUsd(ticket.maxLoss)} tone="red" />
              <MiniStat label="Hold" value={ticket.expectedHold} tone="amber" />
              <MiniStat label="Review" value={ticket.reviewCadence} tone="blue" />
            </div>
            <div className="mt-2 rounded-sm bg-black/25 p-2 text-xs leading-5 text-emerald-100">
              Entry signal needed: {ticket.entrySignalNeeded}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
            Select a buy lead to generate a ticket.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-white/10 bg-black/25 p-1">
            {(["paper", "live"] as const).map((item) => (
              <button
                key={item}
                onClick={() => onModeChange(item)}
                className={`h-8 rounded-sm px-3 text-xs font-bold uppercase transition ${
                  mode === item ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            onClick={onSavePaperTicket}
            disabled={!ticket}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <ClipboardList className="h-4 w-4" />
            Save Ticket
          </button>
        </div>

        {live && (
          <label className="block text-sm text-slate-300">
            <span className="text-amber-100">Live acknowledgement</span>
            <input
              value={acknowledgement}
              onChange={(event) => onAcknowledgementChange(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-amber-200"
              placeholder="Type the configured live acknowledgement phrase"
            />
          </label>
        )}

        {status?.missing && status.missing.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {status.missing.slice(0, 3).map((item) => (
              <span key={item} className="rounded-sm border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
                {item}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={onPlaceOrder}
          disabled={disabled}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${
            live ? "bg-rose-400 text-slate-950 hover:brightness-110" : "bg-cyan-300 text-slate-950 hover:brightness-110"
          }`}
        >
          <Zap className="h-4 w-4" />
          {placing ? "Submitting" : live ? "Place Live Limit Order" : "Place Paper Limit Order"}
        </button>
      </div>
    </div>
  );
}

function FastRiskPanel({
  overview,
  risk,
  status,
  feedQuality,
  secondsAgo,
  staleCount,
}: {
  overview: BrokerOverview | null;
  risk: RiskApiResponse | null;
  status: BrokerStatus | null;
  feedQuality: string;
  secondsAgo: number | null;
  staleCount: number;
}) {
  const account = overview?.account ?? null;
  const clock = overview?.clock ?? null;
  const isOpen = boolField(clock, "is_open");
  const riskFlags = risk?.report?.riskFlags ?? [];

  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle icon={ShieldCheck} title="Risk State" />
        </div>
        <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${isOpen ? "bg-emerald-300 text-slate-950" : "bg-amber-300/20 text-amber-100"}`}>
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Buying power" value={moneyField(account, "buying_power")} tone="green" />
        <MiniStat label="Equity" value={moneyField(account, "equity")} tone="plain" />
        <MiniStat label="Positions" value={`${overview?.positions.length ?? 0}`} tone={(overview?.positions.length ?? 0) ? "amber" : "plain"} />
        <MiniStat label="Open orders" value={`${overview?.orders.length ?? 0}`} tone={(overview?.orders.length ?? 0) ? "amber" : "plain"} />
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <StatusLine label="Broker rail" value={status?.orderPlacementReady ? `${status.mode.toUpperCase()} armed` : "Locked"} ready={Boolean(status?.orderPlacementReady)} />
        <StatusLine label="Data feed" value={`${feedQuality}${secondsAgo === null ? "" : ` / ${secondsAgo}s`}`} ready={staleCount === 0} />
        <StatusLine label="Daily P/L" value={risk?.report?.dailyPnlPct === null || risk?.report?.dailyPnlPct === undefined ? "N/A" : `${risk.report.dailyPnlPct}%`} ready={Boolean(risk?.ok && (risk?.report?.dailyPnlPct ?? 0) >= -1)} />
      </div>

      <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">Risk flags</div>
        <div className="mt-2 space-y-2">
          {riskFlags.length ? (
            riskFlags.slice(0, 3).map((flag) => (
              <div key={flag} className="text-sm leading-5 text-amber-100">{flag}</div>
            ))
          ) : (
            <div className="text-sm text-emerald-200">No active portfolio risk flag returned.</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {marketEvents.slice(0, 2).map((event) => (
          <div key={`${event.market}-${event.name}`} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold text-white">{event.name}</div>
              <span className="rounded-sm bg-amber-300/10 px-2 py-1 text-xs text-amber-200">{event.risk}</span>
            </div>
            <div className="mt-1 line-clamp-1 text-xs text-slate-400">{event.check}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function selectSignalSymbol(symbol: string) {
  window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: symbol }));
}

function IsingBasketPanel({ basket }: { basket: IsingBasketResult }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Selected" value={`${basket.positions}`} tone={basket.positions > 0 ? "green" : "amber"} />
        <MiniStat label="Budget Used" value={formatUsd(basket.budgetUsed)} tone="plain" />
        <MiniStat label="Risk Used" value={formatUsd(basket.riskUsed)} tone={basket.riskUsed <= basket.constraints.maxRiskDollars ? "green" : "red"} />
        <MiniStat label="Max Risk" value={formatUsd(basket.constraints.maxRiskDollars)} tone="amber" />
        <MiniStat label="Objective" value={`${basket.objective}`} tone="blue" />
      </div>

      {basket.selected.length === 0 ? (
        <div className="rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
          <div className="font-semibold text-white">No optimized basket is allowed right now.</div>
          <p className="mt-1 text-sm leading-6 text-amber-100">
            The optimizer found no combination that passed the current freshness, ticket, budget, and risk constraints.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {basket.selected.map((item) => (
            <div key={item.symbol} className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xl font-semibold text-white">{item.symbol}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100">{item.group}</div>
                </div>
                <span className="rounded-sm bg-emerald-300 px-2 py-1 text-xs font-bold text-slate-950">
                  Selected
                </span>
              </div>
              <SymbolSparkline symbol={item.symbol} price={item.entry} compact />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="Score" value={`${item.score}`} tone="green" />
                <MiniStat label="Units" value={`${item.units}`} tone="plain" />
                <MiniStat label="Entry" value={formatUsd(item.entry)} tone="green" />
                <MiniStat label="Risk" value={formatUsd(item.riskDollars)} tone="amber" />
              </div>
              <div className="mt-3 space-y-1">
                {item.reasons.slice(0, 3).map((reason) => (
                  <div key={reason} className="flex gap-2 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-white/10">
        <div className="border-b border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white">
          Skipped By The Optimizer
        </div>
        <div className="divide-y divide-white/10">
          {basket.rejected.slice(0, 5).map((item) => (
            <div key={item.symbol} className="grid gap-2 p-3 text-sm sm:grid-cols-[7rem_1fr_7rem] sm:items-center">
              <div>
                <div className="font-mono font-semibold text-white">{item.symbol}</div>
                <div className="text-xs text-slate-500">{item.group}</div>
              </div>
              <div className="text-slate-300">{item.rejectReason}</div>
              <div className="text-right font-mono text-slate-400">Score {item.score}</div>
            </div>
          ))}
          {basket.rejected.length === 0 && (
            <div className="p-3 text-sm text-slate-400">No skipped candidates yet.</div>
          )}
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        {basket.diagnostics.note} Evaluated {basket.diagnostics.evaluatedCandidates} candidates across {basket.diagnostics.restarts} restarts.
      </p>
    </div>
  );
}

function TrustOperationsTable({ gaps }: { gaps: TrustOperationGap[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-white/10">
      <div className="hidden grid-cols-[1.05fr_5rem_5rem_6rem_1.2fr_1.35fr] gap-3 border-b border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-400 lg:grid">
        <div>Capability / Issue</div>
        <div>Priority</div>
        <div>Status</div>
        <div>Proof State</div>
        <div>Proof Standard</div>
        <div>State / Fix</div>
      </div>
      <div className="divide-y divide-white/10">
        {gaps.map((gap) => (
          <div key={gap.capability} className="grid gap-3 px-3 py-4 text-sm lg:grid-cols-[1.05fr_5rem_5rem_6rem_1.2fr_1.35fr]">
            <div className="min-w-0">
              <div className="font-semibold text-white">{gap.capability}</div>
              <div className="mt-1 text-sm leading-6 text-slate-300">{gap.issue}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{gap.whyItMatters}</div>
            </div>
            <div>
              <PriorityPill priority={gap.priority} />
            </div>
            <div>
              <StatusPill status={gap.status} />
            </div>
            <div>
              <StatusPill status={gap.proofStatus} />
            </div>
            <div className="text-slate-300">
              <div>{gap.evidenceStandard}</div>
              <ul className="mt-2 grid gap-1 pl-4 text-xs leading-5 text-slate-400">
                {gap.acceptanceCriteria.map((criterion) => (
                  <li key={criterion} className="list-disc">{criterion}</li>
                ))}
              </ul>
            </div>
            <div className="text-slate-300">
              <div>{gap.currentState}</div>
              <div className="mt-2 rounded-sm border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-xs leading-5 text-amber-100">
                Next: {gap.nextAction}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperTradesTable({ trades, onRemove }: { trades: PaperTrade[]; onRemove: (id: string) => void }) {
  if (trades.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        No paper tickets saved yet. Save the current trade ticket to start tracking outcomes.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-white/10">
      <div className="divide-y divide-white/10">
        {trades.map((trade) => (
          <div key={trade.id} className="grid gap-3 p-3 text-sm sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-center">
            <div>
              <div className="font-semibold text-white">{trade.symbol}</div>
              <div className="text-xs text-slate-500">{trade.createdAt}</div>
              <SymbolSparkline symbol={trade.symbol} price={trade.entry} compact />
            </div>
            <div className="font-mono text-slate-300">Entry {formatUsd(trade.entry)}</div>
            <div className="font-mono text-amber-200">Stop {formatUsd(trade.stop)}</div>
            <div className="font-mono text-emerald-200">Target {formatUsd(trade.target)}</div>
            <button
              onClick={() => onRemove(trade.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:text-white"
              title="Remove paper ticket"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TrustStatus }) {
  const classes =
    status === "Live"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : status === "Partial"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
        : status === "Blocked"
          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
          : "border-amber-300/25 bg-amber-300/10 text-amber-200";
  return <span className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function PriorityPill({ priority }: { priority: TrustPriority }) {
  const classes =
    priority === "Critical"
      ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
      : priority === "High"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
        : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return <span className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${classes}`}>{priority}</span>;
}

function LiveTickerTape({
  quotes,
  signals,
  buyLeads,
  buyNow,
  secondsAgo,
}: {
  quotes: Quote[];
  signals: TradeSignal[];
  buyLeads: BuyLead[];
  buyNow: BuyNowSignal[];
  secondsAgo: number | null;
}) {
  const tape = quotes.length ? [...quotes, ...quotes] : [];
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol, signal]));
  const buyLeadBySymbol = new Map(buyLeads.map((lead) => [lead.symbol, lead]));
  const buyNowBySymbol = new Map(buyNow.map((signal) => [signal.symbol, signal]));
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="flex h-11 items-center gap-3 overflow-hidden">
        <div className="flex h-full shrink-0 items-center gap-2 border-r border-white/10 bg-emerald-300 px-3 text-xs font-bold uppercase text-slate-950">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-950 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-950" />
          </span>
          Live
        </div>
        <div className="shrink-0 text-xs text-slate-400">
          {secondsAgo === null ? "refreshing" : `${secondsAgo}s ago`}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          {tape.length === 0 ? (
            <div className="text-sm text-slate-500">Loading live ticker tape...</div>
          ) : (
            <div className="ticker-track flex w-max items-center gap-3">
              {tape.map((quote, index) => {
                const up = quote.changePct >= 0;
                const signal = signalBySymbol.get(quote.symbol);
                const lead = buyLeadBySymbol.get(quote.symbol);
                const activeBuyNow = buyNowBySymbol.get(quote.symbol);
                const action = signal ? tickerAction(signal, lead, activeBuyNow) : { label: "LOADING", className: "bg-slate-500/20 text-slate-300" };
                return (
                  <div
                    key={`${quote.symbol}-${index}`}
                    className="flex items-center gap-2 whitespace-nowrap rounded-sm border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm"
                  >
                    <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${action.className}`}>
                      {action.label}
                    </span>
                    <span className="font-semibold text-white">{quote.symbol}</span>
                    <span className="font-mono text-slate-200">{formatUsd(quote.price)}</span>
                    <span className={up ? "font-mono text-emerald-300" : "font-mono text-rose-300"}>
                      {up ? "+" : ""}
                      {quote.changePct.toFixed(2)}%
                    </span>
                    <span className="rounded-sm bg-black/30 px-1.5 py-0.5 text-xs font-semibold text-slate-400">
                      {signal?.dataFresh ? quote.quality : "STALE"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tickerAction(signal: TradeSignal, lead?: BuyLead, buyNow?: BuyNowSignal) {
  if (buyNow) {
    return { label: "BUY NOW", className: "bg-emerald-300 text-slate-950 ring-2 ring-emerald-100/60" };
  }
  if (!signal.dataFresh) {
    return { label: "WAIT - STALE", className: "bg-amber-300/20 text-amber-100" };
  }
  if (signal.action === "Buy Watch" && (signal.quality === "A" || signal.quality === "B")) {
    return { label: "BUY WATCH", className: "bg-emerald-300 text-slate-950" };
  }
  if (signal.action === "Sell/Exit Watch") {
    return { label: "SELL / AVOID", className: "bg-rose-300 text-slate-950" };
  }
  if (lead?.status === "Buy Lead - Wait for Trigger") {
    return { label: "BUY LEAD", className: "bg-cyan-300 text-slate-950" };
  }
  if (signal.action === "Buy Watch") {
    return { label: "RESEARCH BUY", className: "bg-emerald-300/20 text-emerald-100" };
  }
  return { label: "HOLD", className: "bg-slate-500/20 text-slate-300" };
}

function mindsetLabel(mindset: { score: number; stance: string; alignment: number }) {
  return `${mindset.score}/100 ${mindset.stance.replace("-", " ")} (${mindset.alignment}%)`;
}

function mindsetTone(stance: string): "green" | "red" | "amber" | "blue" | "plain" {
  if (stance === "buy-watch") return "green";
  if (stance === "sell-watch" || stance === "risk-off") return "red";
  if (stance === "hold") return "amber";
  return "plain";
}

function SymbolSparkline({
  symbol,
  price,
  changePct,
  compact = false,
}: {
  symbol: string;
  price: number;
  changePct?: number;
  compact?: boolean;
}) {
  const quoteHistory = useContext(QuoteHistoryContext);
  if (!Number.isFinite(price) || price <= 0) return null;
  const data = quoteHistory[symbol]?.length ? quoteHistory[symbol] : makeSpark(symbol, price);
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(price * 0.01, 1);
  const chartWidth = 120;
  const chartHeight = compact ? 38 : 46;
  const points = data
    .map((point, index) => {
      const x = data.length === 1 ? chartWidth : (index / (data.length - 1)) * chartWidth;
      const y = chartHeight - ((point.value - min) / range) * (chartHeight - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastValue = values.at(-1) ?? price;
  const firstValue = values[0] ?? price;
  const up = typeof changePct === "number" ? changePct >= 0 : lastValue >= firstValue;
  const tone = up ? "text-emerald-300" : "text-rose-300";
  const stroke = up ? "#34d399" : "#fb7185";
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-400">
        <span>Price action</span>
        <span className={`font-mono ${tone}`}>
          {typeof changePct === "number" ? formatSignedPct(changePct) : formatUsd(lastValue)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className={compact ? "h-10 w-full" : "h-12 w-full"}
        role="img"
        aria-label={`${symbol} compact price action`}
      >
        <line x1="0" y1={chartHeight - 3} x2={chartWidth} y2={chartHeight - 3} stroke="rgba(148, 163, 184, 0.18)" />
        <polyline className="sparkline-path" points={points} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, explanation }: { icon: typeof Target; title: string; explanation?: string }) {
  const help = explanation ?? sectionExplanations[title];
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {help && <HelpTip text={help} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  const help = metricExplanations[label] ?? `${label}: ${value}`;
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] p-3" title={help} aria-label={`${label}. ${value}. ${help}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
        <Icon className="h-4 w-4 text-cyan-300" />
        <span className="truncate">{label}</span>
        <HelpTip text={help} />
      </div>
      <div className="mt-2 min-h-10 text-pretty text-base font-semibold leading-5 text-white" title={value}>{value}</div>
    </div>
  );
}

function QualityBadge({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  const help = `${label} feed: ${value}. ${ready ? "This source is active or selected." : "This source is available but not currently selected."}`;
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" title={help} aria-label={help}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-white">{label}<HelpTip text={help} /></div>
        <span className={ready ? "text-xs text-emerald-300" : "text-xs text-slate-500"}>
          {ready ? "active" : "available"}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400">{value}</div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  const help = statExplanations[label] ?? `${label}: ${value}`;
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" title={help} aria-label={`${label}. ${value}. ${help}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500">{label}<HelpTip text={help} /></div>
      <div className="mt-1 break-words font-mono text-sm text-white">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, ready = false }: { label: string; value: string; ready?: boolean }) {
  const help = statusExplanations[label] ?? statExplanations[label] ?? `${label}: ${value}`;
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-sm bg-black/20 px-2 py-2" title={help} aria-label={`${label}. ${value}. ${help}`}>
      <span className="flex min-w-0 items-center gap-2 text-slate-400">
        <span className="truncate">{label}</span>
        <HelpTip text={help} />
      </span>
      <span className={`min-w-0 break-words text-right ${ready ? "text-emerald-300" : "text-amber-300"}`}>{value}</span>
    </div>
  );
}

function BuyLeadCard({ lead, rank }: { lead: BuyLead; rank: number }) {
  const active = lead.status === "Buy Watch";
  const possible = lead.status === "Buy Lead - Wait for Trigger";
  const toneClass = active
    ? "border-emerald-300/30 bg-emerald-300/10"
    : possible
      ? "border-cyan-300/25 bg-cyan-300/10"
      : "border-white/10 bg-white/[0.03]";
  const hold = compactHoldLabel(lead.holdingPeriod.expectedHold);
  const help = `${lead.symbol} buy-lead card. It shows whether this symbol is actionable, the trigger required before entry, the stop that invalidates the setup, the target, confidence score, horizon, and data freshness.`;
  return (
    <button
      className={`w-full min-w-0 rounded-md border p-4 text-left transition hover:border-white/30 ${toneClass}`}
      onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: lead.symbol }))}
      title={help}
      aria-label={help}
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] md:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-black/30 font-mono text-xs text-white">
              {rank}
            </span>
            <div className="font-mono text-xl font-semibold text-white">{lead.symbol}</div>
            <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${active ? "bg-emerald-300 text-slate-950" : possible ? "bg-cyan-300 text-slate-950" : "bg-slate-500/20 text-slate-300"}`}>
              {active ? "Buy Watch" : possible ? "Buy Lead" : "No Buy"}
            </span>
          </div>
          <div className="mt-1 max-w-full truncate text-sm text-slate-400">{lead.name}</div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{lead.reason}</p>
          <div className="mt-3 text-xs text-slate-500">
            Move from open: {lead.moveFromOpenPct > 0 ? "+" : ""}
            {lead.moveFromOpenPct}% | Data: {lead.dataFresh ? "fresh" : "stale"}
          </div>
          <SymbolSparkline symbol={lead.symbol} price={lead.price} changePct={lead.moveFromOpenPct} compact />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3">
          <MiniStat label="Trigger" value={formatUsd(lead.trigger)} tone={possible || active ? "green" : "plain"} />
          <MiniStat label="Stop" value={formatUsd(lead.stop)} tone="amber" />
          <MiniStat label="Target" value={formatUsd(lead.target)} tone="blue" />
          <MiniStat label="Score" value={`${lead.confidence}`} tone={lead.confidence >= 60 ? "green" : "plain"} />
          <MiniStat label="Strategy Minds" value={mindsetLabel(lead.strategyMindset)} tone={mindsetTone(lead.strategyMindset.stance)} />
          <MiniStat label="Horizon" value={lead.holdingPeriod.label} tone="amber" />
          <MiniStat label="Hold" value={hold} tone="blue" />
        </div>
      </div>
    </button>
  );
}

function compactHoldLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("intraday") || normalized.includes("trigger")) return "Trigger wait";
  if (normalized.includes("no position")) return "No position";
  if (value.length > 18) return `${value.slice(0, 15).trim()}...`;
  return value;
}

function SignalCard({ signal }: { signal: TradeSignal }) {
  const actionStyle =
    signal.action === "Buy Watch"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : signal.action === "Sell/Exit Watch"
        ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
        : "border-white/10 bg-white/[0.03] text-slate-300";
  const Icon = signal.action === "Buy Watch" ? TrendingUp : signal.action === "Sell/Exit Watch" ? TrendingDown : ShieldCheck;
  const help = `${signal.symbol} signal card. It explains the current action, quality, invalidation level, reward-to-risk, holding period, confirmations, warnings, and freshness.`;

  return (
    <div className={`rounded-md border p-3 ${actionStyle}`} title={help} aria-label={help}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <div className="font-semibold text-white">{signal.symbol}</div>
          </div>
          <div className="mt-1 text-xs text-slate-300">{signal.name}</div>
        </div>
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs font-semibold">{signal.action}</span>
      </div>
      <SymbolSparkline symbol={signal.symbol} price={signal.price} compact />
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Price" value={formatUsd(signal.price)} tone="plain" />
        <MiniStat label="Quality" value={`${signal.quality} / ${signal.confidence}`} tone="blue" />
        <MiniStat label="Invalidation" value={formatUsd(signal.invalidation)} tone="amber" />
        <MiniStat label="R/R" value={`${signal.rewardRisk}R`} tone={signal.rewardRisk >= 1.5 ? "green" : "red"} />
        <MiniStat label="Strategy Minds" value={mindsetLabel(signal.strategyMindset)} tone={mindsetTone(signal.strategyMindset.stance)} />
        <MiniStat label="Horizon" value={signal.holdingPeriod.label} tone="amber" />
        <MiniStat label="Hold" value={signal.holdingPeriod.expectedHold} tone="blue" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs text-slate-200">{signal.market}</span>
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs text-slate-200">{signal.setup}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{signal.reason}</p>
      <div className="mt-3 rounded-sm bg-black/20 p-2 text-xs leading-5 text-slate-300">
        Strategy minds: {signal.strategyMindset.summary}
      </div>
      {signal.confirmations.length > 0 && (
        <div className="mt-3 text-xs leading-5 text-emerald-200">
          Confirmed: {signal.confirmations.join(", ")}
        </div>
      )}
      {signal.warnings.length > 0 && (
        <div className="mt-1 text-xs leading-5 text-amber-200">
          Warnings: {signal.warnings.join(", ")}
        </div>
      )}
      <div className="mt-3 text-xs text-slate-500">
        Risk cap: {signal.positionRiskPct}% | Urgency: {signal.urgency} | Data: {signal.dataFresh ? "fresh" : "stale"}
      </div>
    </div>
  );
}

function LeaderboardColumn({
  title,
  tone,
  signals,
  empty,
}: {
  title: string;
  tone: "green" | "red";
  signals: TradeSignal[];
  empty: string;
}) {
  const toneClass = tone === "green" ? "text-emerald-200 border-emerald-300/20" : "text-rose-200 border-rose-300/20";
  const help = `${title} ranks signals so users can compare symbol, action quality, price, confidence, reward-to-risk, stop, and risk without opening every card.`;
  return (
    <div className={`rounded-md border bg-white/[0.03] ${toneClass}`} title={help} aria-label={help}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 text-sm font-semibold text-white">
        {title}
        <HelpTip text={help} />
      </div>
      <div className="divide-y divide-white/10">
        {signals.length === 0 ? (
          <div className="p-3 text-sm text-slate-400">{empty}</div>
        ) : (
          signals.map((signal, index) => (
            <button
              key={`${signal.symbol}-${signal.action}`}
              className="grid w-full grid-cols-[2rem_1fr] gap-3 p-3 text-left transition hover:bg-white/[0.04]"
              onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: signal.symbol }))}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-black/30 font-mono text-sm text-white">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{signal.symbol}</span>
                    <span className="rounded-sm bg-black/25 px-2 py-1 text-xs">{signal.quality}</span>
                    <span className="rounded-sm bg-black/25 px-2 py-1 text-xs">{signal.setup}</span>
                  </div>
                  <div className="font-mono text-sm text-white">{formatUsd(signal.price)}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <span className="rounded-sm bg-black/20 px-2 py-1">Conf {signal.confidence}</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">R/R {signal.rewardRisk}R</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">Stop {formatUsd(signal.invalidation)}</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">Risk {signal.positionRiskPct}%</span>
                </div>
                <SymbolSparkline symbol={signal.symbol} price={signal.price} compact />
                {signal.warnings.length > 0 && (
                  <div className="mt-2 truncate text-xs text-amber-200">{signal.warnings[0]}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BuyLeadColumn({ leads }: { leads: BuyLead[] }) {
  const help = "Buy Leads ranks candidates that are near a buy setup. A row is a watch candidate unless its trigger, data freshness, and risk checks pass.";
  return (
    <div className="rounded-md border border-cyan-300/20 bg-white/[0.03] text-cyan-100" title={help} aria-label={help}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 text-sm font-semibold text-white">
        Buy Leads
        <HelpTip text={help} />
      </div>
      <div className="divide-y divide-white/10">
        {leads.length === 0 ? (
          <div className="p-3 text-sm text-slate-400">No buy leads are available yet.</div>
        ) : (
          leads.map((lead, index) => (
            <button
              key={`${lead.symbol}-${lead.status}`}
              className="grid w-full grid-cols-[2rem_1fr] gap-3 p-3 text-left transition hover:bg-white/[0.04]"
              onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: lead.symbol }))}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-black/30 font-mono text-sm text-white">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{lead.symbol}</span>
                    <span className="rounded-sm bg-black/25 px-2 py-1 text-xs">{lead.status}</span>
                    {lead.marketStatus && <span className="rounded-sm bg-black/25 px-2 py-1 text-xs">{lead.marketStatus}</span>}
                  </div>
                  <div className="font-mono text-sm text-white">{formatUsd(lead.price)}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <span className="rounded-sm bg-black/20 px-2 py-1">Trigger {formatUsd(lead.trigger)}</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">Stop {formatUsd(lead.stop)}</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">Target {formatUsd(lead.target)}</span>
                  <span className="rounded-sm bg-black/20 px-2 py-1">Hold {lead.holdingPeriod.expectedHold}</span>
                </div>
                <SymbolSparkline symbol={lead.symbol} price={lead.price} changePct={lead.moveFromOpenPct} compact />
                {lead.warnings.length > 0 && (
                  <div className="mt-2 truncate text-xs text-amber-200">{lead.warnings[0]}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AlgorithmCouncilPanel({ council }: { council: AlgorithmCouncilResponse | null }) {
  if (!council) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        Waiting for the algorithm council to score the watchlist.
      </div>
    );
  }
  if (!council.ok) {
    return (
      <div className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
        {council.error ?? "Algorithm council is unavailable."}
      </div>
    );
  }
  const scores = council.scores ?? [];
  const families = council.algorithms ?? [];

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {families.slice(0, 6).map((algorithm) => (
          <div key={algorithm.key} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-sm font-semibold text-white">{algorithm.name}</div>
            <div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{algorithm.purpose}</div>
          </div>
        ))}
      </div>
      {council.advisory && (
        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          {council.advisory}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        {scores.slice(0, 6).map((score) => (
          <button
            key={score.symbol}
            className={`w-full min-w-0 rounded-md border p-3 text-left transition hover:border-white/30 ${algorithmTone(score.recommendation)}`}
            onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: score.symbol }))}
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold text-white">{score.symbol}</span>
                  <span className="rounded-sm bg-black/25 px-2 py-1 text-xs font-semibold text-slate-200">
                    {score.ensembleScore}/100
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">{score.name}{score.sector ? ` | ${score.sector}` : ""}</div>
              </div>
              <span className="w-fit max-w-full rounded-sm bg-black/25 px-2 py-1 text-xs font-bold uppercase text-white sm:shrink-0">
                {score.recommendation}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{score.plainAction}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MiniStat label="Trust" value={`${score.confidence}`} tone={score.confidence >= 70 ? "green" : "amber"} />
              <MiniStat label="Coverage" value={`${score.dataCoveragePct}%`} tone={score.dataCoveragePct >= 70 ? "green" : "amber"} />
              <MiniStat label="Bear Case" value={score.bearCase.slice(0, 18)} tone="red" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {score.factorScores.slice(0, 4).map((factor) => (
                <span key={factor.name} className="rounded-sm bg-black/25 px-2 py-1 text-xs text-slate-300">
                  {factor.name} {factor.score}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InstitutionalReadinessPanel({ readiness }: { readiness: InstitutionalReadinessApi | null }) {
  if (!readiness) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        Checking institutional gates.
      </div>
    );
  }
  const gates = readiness.proof?.gates ?? [];
  const workerReady = readiness.workers?.components.filter((item) => item.ready).length ?? 0;
  const workerTotal = readiness.workers?.components.length ?? 0;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <MiniStat
          label="Proof"
          value={readiness.proof ? `${readiness.proof.summary.passed}/${gates.length}` : "N/A"}
          tone={readiness.proof?.grade === "green" ? "green" : readiness.proof?.grade === "amber" ? "amber" : "red"}
        />
        <MiniStat
          label="Kill Switch"
          value={readiness.controls?.killSwitch ? "On" : "Off"}
          tone={readiness.controls?.killSwitch ? "red" : "green"}
        />
        <MiniStat
          label="Workers"
          value={workerTotal ? `${workerReady}/${workerTotal}` : "N/A"}
          tone={readiness.workers?.grade === "ready" ? "green" : readiness.workers?.grade === "partial" ? "amber" : "red"}
        />
        <MiniStat
          label="Boundary"
          value={readiness.compliance?.grade ?? "N/A"}
          tone={readiness.compliance?.grade === "blocked" ? "red" : readiness.compliance?.grade === "research-only" ? "green" : "amber"}
        />
      </div>
      {readiness.missing && readiness.missing.length > 0 && (
        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          {readiness.missing.join(" ")}
        </div>
      )}
      <div className="grid gap-2 lg:grid-cols-3">
        {gates.slice(0, 6).map((gate) => (
          <div key={gate.key} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">{gate.label}</div>
              <span className={gate.status === "pass" ? "text-xs text-emerald-300" : gate.status === "partial" ? "text-xs text-amber-300" : "text-xs text-rose-300"}>
                {gate.status}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{gate.evidence}</p>
            <p className="mt-2 text-xs leading-5 text-cyan-100">{gate.fix}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="font-semibold text-white">Execution Controls</div>
          <div className="mt-3 grid gap-2">
            <StatusLine label="Paper orders" value={readiness.controls?.allowPaperOrders ? "Allowed" : "Blocked"} ready={Boolean(readiness.controls?.allowPaperOrders)} />
            <StatusLine label="Live orders" value={readiness.controls?.allowLiveOrders ? "Allowed" : "Blocked"} ready={Boolean(readiness.controls?.allowLiveOrders)} />
            <StatusLine label="Max open" value={`${readiness.controls?.maxOpenOrders ?? "N/A"}`} ready />
            <StatusLine label="Daily notional" value={`${readiness.controls?.maxDailySubmittedNotional ?? "N/A"}`} ready />
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="font-semibold text-white">Worker State</div>
          <div className="mt-3 grid gap-2">
            {(readiness.workers?.components ?? []).map((component) => (
              <StatusLine key={component.key} label={component.label} value={component.ready ? "Ready" : "Needed"} ready={component.ready} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentTradingPanel({
  agent,
  message,
  executing,
  onRunPaperAgent,
}: {
  agent: AgentTraderApi | null;
  message: string;
  executing: boolean;
  onRunPaperAgent: (symbol?: string) => void;
}) {
  if (!agent) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        Checking supervised agent trading policy.
      </div>
    );
  }

  const policy = agent.policy;
  const proposals = agent.proposals ?? [];
  const top = proposals[0];
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Agent Trading" value={policy?.enabled ? "Enabled" : "Locked"} tone={policy?.enabled ? "green" : "amber"} />
        <MiniStat label="Paper Agent" value={policy?.paperAutomationReady ? "Ready" : "Locked"} tone={policy?.paperAutomationReady ? "green" : "amber"} />
        <MiniStat label="Live Orders" value="Manual rail" tone="amber" />
        <MiniStat label="Min Trust" value={`${policy?.minConfidence ?? 75}`} tone="blue" />
        <MiniStat label="Proposals" value={`${proposals.length}`} tone={proposals.length ? "green" : "plain"} />
      </div>

      <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
        {message} Agents may help prepare orders; live-money submission uses the manual broker rail.
      </div>

      {policy?.missing && policy.missing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {policy.missing.slice(0, 5).map((item) => (
            <span key={item} className="rounded-sm border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300">
              {item}
            </span>
          ))}
        </div>
      )}

      {top ? (
        <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-2xl font-semibold text-white">{top.symbol}</span>
                <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${top.status === "paper-ready" ? "bg-emerald-300 text-slate-950" : "bg-amber-300/20 text-amber-100"}`}>
                  {top.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-cyan-100">
                Agent draft: buy {top.orderDraft.qty} at {formatUsd(top.orderDraft.limitPrice)} with stop {formatUsd(top.orderDraft.stopLossStopPrice ?? top.ticket.stop)} and target {formatUsd(top.orderDraft.takeProfitLimitPrice ?? top.ticket.target)}.
              </p>
            </div>
            <button
              onClick={() => onRunPaperAgent(top.symbol)}
              disabled={executing || !policy?.paperAutomationReady || top.status !== "paper-ready"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Bot className={`h-4 w-4 ${executing ? "animate-spin" : ""}`} />
              Paper Trade With Agent
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat label="Confidence" value={`${top.confidence}`} tone={top.confidence >= 80 ? "green" : "blue"} />
            <MiniStat label="Units" value={`${top.orderDraft.qty}`} tone="plain" />
            <MiniStat label="Entry" value={formatUsd(top.orderDraft.limitPrice)} tone="green" />
            <MiniStat label="Stop" value={formatUsd(top.orderDraft.stopLossStopPrice ?? top.ticket.stop)} tone="amber" />
            <MiniStat label="Target" value={formatUsd(top.orderDraft.takeProfitLimitPrice ?? top.ticket.target)} tone="blue" />
            <MiniStat label="Hold" value={top.ticket.expectedHold} tone="amber" />
          </div>
          <div className="mt-3 rounded-sm bg-black/20 p-2 text-xs leading-5 text-cyan-100">
            Exit rule: {top.ticket.exitRule}
          </div>
          <div className="mt-3 space-y-1">
            {top.reasons.slice(0, 3).map((reason) => (
              <div key={reason} className="flex gap-2 text-sm leading-6 text-slate-200">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
          {top.blockers.length > 0 && (
            <div className="mt-3 rounded-sm bg-black/20 p-2 text-sm leading-6 text-amber-100">
              {top.blockers.join(" ")}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
          No agent proposal currently passes the strict buy-now gate. The agent is waiting instead of forcing a trade.
        </div>
      )}

      {agent.advisory && <p className="text-xs leading-5 text-slate-500">{agent.advisory}</p>}
    </div>
  );
}

function FusionAlphaPanel({
  predictions,
  selected,
  generatedAt,
  error,
  onSelect,
}: {
  predictions: FusionPrediction[];
  selected: FusionPrediction | undefined;
  generatedAt?: string;
  error?: string;
  onSelect: (symbol: string) => void;
}) {
  if (error) {
    return (
      <div className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
        {error}
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        Waiting for quotes before Fusion Alpha can score the engine map.
      </div>
    );
  }

  const activeEngines = selected.engineFindings.filter((finding) => finding.status === "active").length;
  const proxyEngines = selected.engineFindings.filter((finding) => finding.status === "proxy").length;
  const blockedEngines = selected.engineFindings.filter((finding) => finding.status === "blocked").length;
  const actionClass = fusionActionClass(selected.action);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-3xl font-semibold text-white">{selected.symbol}</span>
              <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${actionClass}`}>{selected.action}</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100">{selected.thesis}</p>
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-xs sm:w-56 sm:shrink-0">
            <MiniStat label="Fusion" value={`${selected.score}/100`} tone={selected.score >= 65 ? "green" : selected.score <= 44 ? "red" : "amber"} />
            <MiniStat label="Trust" value={`${selected.confidence}/100`} tone={selected.confidence >= 70 ? "green" : "blue"} />
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <MiniStat label="Horizon" value={selected.horizon} tone="amber" />
          <MiniStat label="Expected Hold" value={selected.expectedHold} tone="blue" />
          <MiniStat label="Entry" value={selected.entry ? formatUsd(selected.entry) : "No entry"} tone="green" />
          <MiniStat label="Stop" value={selected.stop ? formatUsd(selected.stop) : "No stop"} tone="amber" />
          <MiniStat label="Target" value={selected.target ? formatUsd(selected.target) : "No target"} tone="blue" />
          <MiniStat label="R/R" value={selected.rewardRisk ? `${selected.rewardRisk}R` : "N/A"} tone="plain" />
          <MiniStat label="Forecast P/L" value={selected.forecast.units > 0 ? formatSignedUsd(selected.forecast.projectedPnl) : "No forecast"} tone={selected.forecast.projectedPnl >= 0 ? "green" : "red"} />
          <MiniStat label="Max Loss" value={selected.forecast.maxLoss > 0 ? formatUsd(selected.forecast.maxLoss) : "N/A"} tone="red" />
        </div>

        <div className="mt-3 rounded-sm bg-black/20 p-2 text-sm leading-6 text-white">
          {selected.operatorAction}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-sm bg-black/20 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Engine Coverage</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <MiniStat label="Active" value={`${activeEngines}`} tone="green" />
              <MiniStat label="Proxy" value={`${proxyEngines}`} tone="blue" />
              <MiniStat label="Blocked" value={`${blockedEngines}`} tone={blockedEngines ? "red" : "plain"} />
            </div>
          </div>
          <div className="rounded-sm bg-black/20 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Top Support</div>
            <div className="mt-2 space-y-1 text-xs leading-5 text-emerald-100">
              {(selected.topSupports.length ? selected.topSupports : selected.engineFindings.slice(0, 2)).slice(0, 3).map((finding) => (
                <div key={finding.key}>{finding.label}: {finding.score}/100</div>
              ))}
            </div>
          </div>
          <div className="rounded-sm bg-black/20 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Critical Friction</div>
            <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100">
              {(selected.blockers.length ? selected.blockers : selected.conflicts.length ? selected.conflicts : ["No major blocker in current fusion view."]).slice(0, 3).map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-1 text-xs leading-5 text-blue-100 sm:grid-cols-2">
          {selected.algorithmFindings.map((finding) => (
            <div key={finding.key} className="rounded-sm bg-black/20 px-2 py-1">
              {finding.name}: {finding.score}/100
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-4">
        {predictions.slice(0, 4).map((prediction) => (
          <button
            key={prediction.symbol}
            onClick={() => onSelect(prediction.symbol)}
            className={`rounded-md border p-3 text-left transition ${
              prediction.symbol === selected.symbol
                ? "border-cyan-300 bg-cyan-300/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-lg font-semibold text-white">{prediction.symbol}</div>
                <div className="mt-1 text-xs text-slate-500">{prediction.expectedHold}</div>
              </div>
              <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase ${fusionActionClass(prediction.action)}`}>
                {prediction.action}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="Fusion" value={`${prediction.score}`} tone={prediction.score >= 65 ? "green" : prediction.score <= 44 ? "red" : "amber"} />
              <MiniStat label="Trust" value={`${prediction.confidence}`} tone="blue" />
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs leading-5 text-slate-500">
        {generatedAt ? `Full Fusion Alpha run: ${new Date(generatedAt).toLocaleString()}` : "Live proxy updates with the dashboard; run Fusion Alpha for backtest and native debate refresh."}
      </div>
    </div>
  );
}

function ResearchStackPanel({ stack, autoResearch }: { stack: ResearchStackApi | null; autoResearch: AutoResearchApi | null }) {
  if (!stack) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
        Checking data providers, research workers, and database readiness.
      </div>
    );
  }
  const missingWorkers = stack.components.filter((component) => component.mode === "missing" && ["backtesting", "ai-research", "crypto", "fundamentals"].includes(component.category));
  const providerRows = stack.components.filter((component) => ["market-data", "news", "filings", "database"].includes(component.category));
  const workerRows = stack.components.filter((component) => ["fundamentals", "backtesting", "ai-research", "crypto"].includes(component.category));
  const recentRuns = autoResearch?.recentRuns ?? [];

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Stack Grade" value={stack.grade} tone={stack.grade === "production-path" ? "green" : stack.grade === "research-ready" ? "blue" : "amber"} />
        <MiniStat label="Configured" value={`${stack.configured}/${stack.total}`} tone={stack.configured >= 8 ? "green" : "amber"} />
        <MiniStat label="Critical" value={`${stack.criticalConfigured}/${stack.criticalTotal}`} tone={stack.criticalConfigured === stack.criticalTotal ? "green" : "red"} />
        <MiniStat label="Workers" value={`${workerRows.filter((item) => item.ready).length}/${workerRows.length}`} tone={missingWorkers.length <= 3 ? "green" : "amber"} />
        <MiniStat label="AutoResearch" value={recentRuns.length ? `${recentRuns.length} run(s)` : `${autoResearch?.candidates?.length ?? 0} candidates`} tone={recentRuns.length ? "green" : "blue"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <div className="font-semibold text-white">Data And News Providers</div>
          <div className="mt-3 grid gap-2">
            {providerRows.map((component) => (
              <ResearchStackRow key={component.key} component={component} />
            ))}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <div className="font-semibold text-white">External Research Workers</div>
          <div className="mt-3 grid gap-2">
            {workerRows.map((component) => (
              <ResearchStackRow key={component.key} component={component} />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
        <div className="font-semibold text-white">Still External</div>
        <div className="mt-2 grid gap-1">
          {stack.missingExternalEntitlements.slice(0, 5).map((item) => (
            <div key={item}>- {item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResearchStackRow({ component }: { component: ResearchStackApi["components"][number] }) {
  return (
    <div className="rounded-sm bg-black/20 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-white">{component.label}</div>
          <div className="mt-1 text-slate-400">{component.detail}</div>
        </div>
        <span className={`shrink-0 rounded-sm px-2 py-1 font-semibold ${stackModeClass(component)}`}>
          {component.ready ? component.mode : "missing"}
        </span>
      </div>
      {!component.ready && component.freeAlternative && (
        <div className="mt-2 text-amber-100">Fallback: {component.freeAlternative}</div>
      )}
      {component.env.length > 0 && (
        <div className="mt-2 font-mono text-xs font-semibold text-slate-400">
          {component.env.join(" | ")}
        </div>
      )}
    </div>
  );
}

function stackModeClass(component: ResearchStackApi["components"][number]) {
  if (component.ready && component.mode === "credentialed") return "bg-emerald-300 text-slate-950";
  if (component.ready && component.mode === "free-fallback") return "bg-cyan-300 text-slate-950";
  if (component.ready && component.mode === "worker") return "bg-blue-300 text-slate-950";
  if (component.ready && component.mode === "native") return "bg-emerald-300 text-slate-950";
  return "bg-amber-300/20 text-amber-100";
}

function AutoResearchPanel({ result }: { result: AutoResearchApi | null }) {
  if (!result) {
    return (
      <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
        AutoResearch is ready to run a bounded strategy-candidate loop. It stores champions, rejected variants, and risk notes in Postgres when the database is available.
      </div>
    );
  }
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
        {result.error ?? "AutoResearch is unavailable."}
      </div>
    );
  }

  const champion = result.champion;
  const experiments = result.experiments ?? [];
  return (
    <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-white">AutoResearch Lab</div>
          <div className="mt-1 text-xs leading-5 text-emerald-100">
            {result.advisory ?? result.guardrail ?? "Research-only experiment loop is available."}
          </div>
        </div>
        <span className="rounded-sm bg-black/25 px-2 py-1 text-xs font-semibold text-emerald-100">
          {result.runLabel ? "Latest run" : `${result.candidates?.length ?? 0} candidates`}
        </span>
      </div>

      {champion && champion.metrics && (
        <div className="mt-3 rounded-md border border-emerald-300/20 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">Champion: {champion.candidate.name}</div>
              <div className="mt-1 text-xs text-slate-400">{champion.candidate.hypothesis}</div>
            </div>
            <span className="font-mono text-sm text-emerald-200">Score {champion.score}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            <MiniStat label="Trades" value={`${champion.metrics.trades}`} tone="blue" />
            <MiniStat label="Win" value={`${champion.metrics.winRate}%`} tone={champion.metrics.winRate >= 50 ? "green" : "amber"} />
            <MiniStat label="Avg" value={`${champion.metrics.avgReturnPct}%`} tone={champion.metrics.avgReturnPct >= 0 ? "green" : "red"} />
            <MiniStat label="Total" value={`${champion.metrics.totalReturnPct}%`} tone={champion.metrics.totalReturnPct >= 0 ? "green" : "red"} />
            <MiniStat label="Max DD" value={`${champion.metrics.maxDrawdownPct}%`} tone="amber" />
            <MiniStat label="PF" value={`${champion.metrics.profitFactor}`} tone={champion.metrics.profitFactor >= 1 ? "green" : "red"} />
            <MiniStat label="Verdict" value={champion.verdict} tone="green" />
          </div>
          <div className="mt-3 text-xs leading-5 text-amber-100">
            {champion.risks.slice(0, 2).join(" ")}
          </div>
        </div>
      )}

      {experiments.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {experiments.slice(0, 6).map((experiment) => (
            <div key={experiment.candidate.id} className="rounded-sm bg-black/20 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{experiment.candidate.name}</span>
                <span className={experiment.verdict === "champion" ? "text-emerald-300" : experiment.verdict === "promising" ? "text-cyan-300" : "text-slate-500"}>
                  {experiment.verdict}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-slate-300">
                <span>Score {experiment.score}</span>
                <span>Trades {experiment.metrics?.trades ?? 0}</span>
                <span>Win {experiment.metrics?.winRate ?? 0}%</span>
                <span>PF {experiment.metrics?.profitFactor ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TradingAgentsPanel({ result }: { result: TradingAgentsApi | null }) {
  if (!result) {
    return (
      <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
        TradingAgents runs inside this app across market, fundamentals, bull/bear, trader, risk, and portfolio-manager roles. Results can be persisted as notes when Postgres is available.
      </div>
    );
  }
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
        {result.error ?? "TradingAgents is unavailable."}
      </div>
    );
  }

  const decisions = result.decisions ?? [];
  const nativeCodebase = result.source === "native-codebase-debate";
  return (
    <div className="mt-4 rounded-md border border-blue-300/20 bg-blue-300/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-white">
            {nativeCodebase ? "Native Codebase Debate" : "TradingAgents Debate"}
          </div>
          <div className="mt-1 text-xs leading-5 text-blue-100">
            {result.advisory ?? "Research-only multi-agent debate completed."}
          </div>
        </div>
        <span className="rounded-sm bg-black/25 px-2 py-1 text-xs font-semibold text-blue-100">
          {result.requested
            ? `${result.requested.symbols.length} symbol(s) / ${result.requested.depth}${nativeCodebase ? " / in-app" : ""}`
            : `${decisions.length} decision(s)`}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {decisions.map((decision) => (
          <div key={decision.symbol} className="rounded-md border border-blue-300/20 bg-black/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">{decision.symbol}</div>
                <div className="mt-1 text-xs text-slate-400">{decision.action}</div>
              </div>
              <span className="rounded-sm bg-blue-300 px-2 py-1 text-xs font-semibold text-slate-950">
                {decision.rating}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{decision.summary}</p>
            <div className="mt-3 text-xs leading-5 text-blue-100">
              Portfolio: {decision.portfolioDecision}
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <MiniStat label="Horizon" value={decision.holdingPeriod} tone="amber" />
              <MiniStat label="Expected Hold" value={decision.expectedHold} tone="blue" />
              <MiniStat label="Max Hold" value={decision.maxHold} tone="plain" />
              <MiniStat label="Evidence" value={decision.evidenceGrade} tone={decision.evidenceGrade.toLowerCase().includes("strong") ? "green" : decision.evidenceGrade.toLowerCase().includes("blocked") ? "red" : "amber"} />
            </div>
            <div className="mt-3 text-xs leading-5 text-slate-300">
              Exit: {decision.exitRule}
            </div>
            <div className="mt-3 grid gap-1 text-xs leading-5 text-blue-100">
              {decision.evidenceSummary.slice(0, 3).map((item) => (
                <div key={item}>Evidence: {item}</div>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-xs leading-5 text-amber-100">
              {decision.risks.slice(0, 3).map((risk) => (
                <div key={risk}>- {risk}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {result.persistedNotes && result.persistedNotes.length > 0 && (
        <div className="mt-3 text-xs leading-5 text-blue-100">
          Stored {result.persistedNotes.length} TradingAgents note(s) in the research journal.
        </div>
      )}
    </div>
  );
}

function algorithmTone(recommendation: AlgorithmCouncilScore["recommendation"]) {
  if (recommendation === "Strong Buy Watch") return "border-emerald-300/30 bg-emerald-300/10";
  if (recommendation === "Buy Watch") return "border-cyan-300/25 bg-cyan-300/10";
  if (recommendation === "Avoid / Sell Watch") return "border-rose-300/25 bg-rose-300/10";
  return "border-white/10 bg-white/[0.03]";
}

function StrategyTile({ strategy }: { strategy: StrategyProfile }) {
  const positive = strategy.expectedReturn >= 0;
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-white">{strategy.name}</div>
          <div className="mt-1 text-xs text-cyan-200">{strategy.repo}</div>
        </div>
        <span className="rounded-sm bg-white/10 px-2 py-1 font-mono text-xs text-white">{strategy.robustness}</span>
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">{strategy.description}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Return" value={`${positive ? "+" : ""}${strategy.expectedReturn}%`} tone={positive ? "green" : "red"} />
        <MiniStat label="Max DD" value={`${strategy.maxDrawdown}%`} tone="amber" />
        <MiniStat label="Win" value={`${strategy.winRate}%`} tone="blue" />
        <MiniStat label="Trades" value={`${strategy.trades}`} tone="plain" />
      </div>
    </div>
  );
}

function RealBacktestPanel({ result }: { result: BacktestApiResponse | null }) {
  if (!result) {
    return (
      <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
        Run a real backtest to pull Alpaca historical bars, apply slippage and fees, store the run in Postgres, and compare the watchlist against the same rule set.
      </div>
    );
  }
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
        {result.error ?? "The real backtest could not run."}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-white">Real Historical Backtest</div>
          <div className="mt-1 text-xs leading-5 text-cyan-100">{result.advisory}</div>
        </div>
        <span className="rounded-sm bg-black/25 px-2 py-1 text-xs font-semibold text-cyan-100">Stored in SQL</span>
      </div>
      {result.metrics && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <MiniStat label="Symbols" value={`${result.metrics.symbolsTested}`} tone="plain" />
          <MiniStat label="Trades" value={`${result.metrics.trades}`} tone="blue" />
          <MiniStat label="Win" value={`${result.metrics.winRate}%`} tone={result.metrics.winRate >= 50 ? "green" : "amber"} />
          <MiniStat label="Avg" value={`${result.metrics.avgReturnPct}%`} tone={result.metrics.avgReturnPct >= 0 ? "green" : "red"} />
          <MiniStat label="Total" value={`${result.metrics.totalReturnPct}%`} tone={result.metrics.totalReturnPct >= 0 ? "green" : "red"} />
          <MiniStat label="Max DD" value={`${result.metrics.maxDrawdownPct}%`} tone="amber" />
          <MiniStat label="PF" value={`${result.metrics.profitFactor}`} tone={result.metrics.profitFactor >= 1 ? "green" : "red"} />
        </div>
      )}
      <div className="mt-3 grid gap-2 lg:grid-cols-4">
        {(result.results ?? []).slice(0, 8).map((item) => (
          <div key={item.symbol} className="rounded-sm bg-black/20 p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white">{item.symbol}</span>
              <span className="text-slate-400">{item.status}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-slate-300">
              <span>Trades {item.trades}</span>
              <span>Win {item.winRate}%</span>
              <span>Total {item.totalReturnPct}%</span>
              <span>DD {item.maxDrawdownPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngineCard({ engine, finding }: { engine: EngineCapability; finding?: FusionEngineFinding }) {
  const safetyClass =
    engine.safety === "Live capable, gated"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : engine.safety === "Paper trading"
        ? "border-blue-300/25 bg-blue-300/10 text-blue-100"
        : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  const findingClass =
    finding?.impact === "supports"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      : finding?.impact === "challenges"
        ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
        : finding?.impact === "guards"
          ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
          : "border-white/10 bg-white/10 text-slate-200";

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-white">{engine.productName}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">{engine.repo}</div>
        </div>
        <span className={`rounded-sm border px-2 py-1 text-xs ${safetyClass}`}>{engine.safety}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-sm bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">{engine.lane}</span>
        <span className="rounded-sm bg-white/10 px-2 py-1 text-xs text-slate-300">{engine.integrationMode}</span>
        <span className="rounded-sm bg-white/10 px-2 py-1 text-xs text-slate-300">{engine.priority}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{engine.featureUnlocked}</p>
      {finding && (
        <div className={`mt-3 rounded-sm border p-2 text-xs leading-5 ${findingClass}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold uppercase">{finding.impact}</span>
            <span className="font-mono">{finding.score}/100 | w {finding.weight.toFixed(2)}</span>
          </div>
          <div className="mt-2 text-slate-100">{finding.finding}</div>
          <div className="mt-2 font-mono text-xs uppercase text-slate-300">
            {finding.status} | {finding.stance}
          </div>
        </div>
      )}
    </div>
  );
}

function fusionActionClass(action: FusionPrediction["action"]) {
  if (action === "Strong Buy / Paper Candidate") return "bg-emerald-300 text-slate-950";
  if (action === "Buy Watch") return "bg-cyan-300 text-slate-950";
  if (action === "Sell / Avoid") return "bg-rose-300 text-slate-950";
  if (action === "Reduce / Avoid Adds") return "bg-amber-300 text-slate-950";
  if (action === "Data Review") return "bg-slate-300 text-slate-950";
  return "bg-white/10 text-slate-200";
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "amber" | "blue" | "plain";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-rose-300"
        : tone === "amber"
          ? "text-amber-300"
          : tone === "blue"
            ? "text-cyan-300"
            : "text-white";
  const help = statExplanations[label] ?? `${label}: ${value}`;
  return (
    <div className="min-h-[4.25rem] min-w-0 rounded-sm bg-black/20 p-2" title={help} aria-label={`${label}. ${value}. ${help}`}>
      <div className="flex items-start gap-1.5 text-xs font-semibold text-slate-400">
        <span className="min-w-0 break-words">{label}</span>
        <HelpTip text={help} />
      </div>
      <div className={`mt-1 break-words font-mono text-sm leading-6 tabular-nums ${color}`} title={`${value}. ${help}`}>
        {value}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-cyan-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-cyan-300"
      />
    </label>
  );
}
