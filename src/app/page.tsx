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
  Newspaper,
  Plus,
  RefreshCcw,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { engineCapabilities, engineWorkflow, type EngineCapability } from "@/lib/engineCatalog";
import { generateBuyLeads, generateSignals, scoreQuote, type BuyLead, type TradeSignal } from "@/lib/signalEngine";
import { dayTradingBestPractices, dayTradingRules } from "@/lib/dayTradingPlaybook";
import { calculatePositionSize } from "@/lib/positionSizing";
import { marketEvents } from "@/lib/events";
import { trustBuildOrder, trustOperationGaps, trustSummary, type TrustStatus } from "@/lib/trustOperations";
import { buildBuyTradeTicket, type TradeTicket } from "@/lib/tradeTicket";
import { generateBuyNowSignals, type BlockedBuyNowSignal, type BuyNowSignal } from "@/lib/buyNowEngine";
import { optimizeTradeBasketFromLeads, type IsingBasketResult } from "@/lib/isingOptimizer";

const PriceChart = dynamic(() => import("@/components/PriceChart"), {
  ssr: false,
  loading: () => <div className="h-full rounded-md border border-white/10 bg-black/20" />,
});

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
    trades: number;
    winRate: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    status: string;
  }>;
  advisory?: string;
  error?: string;
};

type AlgorithmCouncilScore = {
  symbol: string;
  name: string;
  sector?: string;
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
    mode: "credentialed" | "free-fallback" | "worker" | "missing";
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
    summary: string;
    thesis: string;
    risks: string[];
    portfolioDecision: string;
  }>;
  persistedNotes?: Array<Record<string, unknown>>;
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
  const [agentTrader, setAgentTrader] = useState<AgentTraderApi | null>(null);
  const [researchNotes, setResearchNotes] = useState<ResearchNote[]>([]);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [autoResearchRunning, setAutoResearchRunning] = useState(false);
  const [tradingAgentsRunning, setTradingAgentsRunning] = useState(false);
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

  useEffect(() => {
    window.localStorage.setItem("ti_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    window.localStorage.setItem("ti_journal", JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    window.localStorage.setItem("ti_paper_trades", JSON.stringify(paperTrades));
  }, [paperTrades]);

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
      setQuotes(marketData.quotes ?? []);
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

  async function placeBrokerOrder(ticket: TradeTicket | null) {
    if (!ticket || !brokerStatus) return;
    setPlacingOrder(true);
    setBrokerMessage("Submitting broker order request");
    const clientOrderId = `ti-${ticket.symbol}-${crypto.randomUUID().slice(0, 18)}`;
    try {
      const response = await fetch(`/api/broker/orders?mode=${brokerMode}`, {
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
  const algorithmScores = algorithmCouncil?.scores ?? [];
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
  const topSell = sellLeaders[0];
  const staleStocks = signals.filter((signal) => !signal.dataFresh && signal.market === "Stock/ETF");
  const operationsSummary = trustSummary();
  const criticalGaps = trustOperationGaps.filter((gap) => gap.priority === "Critical");
  const proofCoveragePct = Math.round(((operationsSummary.live + operationsSummary.partial * 0.5) / operationsSummary.total) * 100);
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

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <LiveTickerTape quotes={quotes} signals={signals} buyLeads={buyLeads} buyNow={buyNowSignals} secondsAgo={secondsAgo} />
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
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
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                {secondsAgo === null ? "Waiting for quote refresh" : `Quotes ${secondsAgo}s old`} | {feedQuality} | limit orders only.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={refresh}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-100"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Metric icon={Activity} label="Feed" value={status} />
            <Metric icon={TrendingUp} label="Market Scan" value={`${green}/${quotes.length || watchlist.length} green, ${movers} movers`} />
            <Metric icon={Gauge} label="Proof Coverage" value={`${proofCoveragePct}% live/partial`} />
            <Metric icon={BellRing} label="Signals" value={`${buyNowSignals.length} buy-now, ${activeBuyLeads.length} buy leads`} />
            <Metric icon={Brain} label="Algorithm Council" value={topAlgorithmScore ? `${topAlgorithmScore.symbol} ${topAlgorithmScore.ensembleScore}/100` : "Loading"} />
            <Metric icon={ShieldCheck} label="Institutional Gates" value={institutionalGrade} />
            <Metric icon={ServerCog} label="Research Stack" value={researchStack ? `${researchStack.configured}/${researchStack.total} ${researchStack.grade}` : "Checking"} />
          </div>
          <TrustReadinessStrip summary={operationsSummary} brokerStatus={brokerStatus} aitableStatus={aitableStatus} />
          <ProductionOpsStrip ops={opsStatus} risk={riskStatus} performance={modelPerformance} />
        </div>
      </section>

      <section className="border-b border-[var(--border)] bg-[#090d12]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(20rem,0.85fr)]">
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.5fr_0.9fr] lg:px-8">
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={Bot} title="AI Agent Trading" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Agents can propose trades and paper-trade when explicitly enabled. Manual live orders go through the Broker Execution Rail.
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

          <Panel>
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

          <Panel>
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

          <Panel>
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

          <Panel>
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

          <Panel>
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
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              {visibleBuyLeads.map((lead, index) => (
                <BuyLeadCard key={lead.symbol} lead={lead} rank={index + 1} />
              ))}
            </div>
          </Panel>

          <Panel>
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

          <Panel>
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

          <Panel>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionTitle icon={ShieldCheck} title="Trust Matrix" />
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  The biggest gap is not more tickers. It is proof: durable outcomes after slippage, fees, and different market conditions.
                </p>
              </div>
              <span className="rounded-sm border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
                {criticalGaps.length} critical systems tracked
              </span>
            </div>
            <TrustOperationsTable gaps={trustOperationGaps} />
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
                      <span className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${cardAction.className}`}>
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
              The requested GitHub repos are now represented as product capabilities, with the heavy Python/C#/Rust
              engines kept behind worker or external-engine boundaries so Vercel stays fast on your phone.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {engineCapabilities.map((engine) => (
                <EngineCard key={engine.repo} engine={engine} />
              ))}
            </div>
          </Panel>

          <Panel>
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

        <aside className="space-y-4">
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
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">{children}</div>;
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
    <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm sm:grid-cols-5">
      <StatusLine label="Trade ticket" value="Live" ready />
      <StatusLine label="Proof systems" value={`${summary.live} live / ${summary.partial} partial`} ready={summary.live > 0} />
      <StatusLine label="Critical gaps" value={`${summary.critical} tracked`} />
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
    <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm md:grid-cols-2 xl:grid-cols-5">
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
    <div className="h-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
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
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <MiniStat label="Now" value={formatUsd(primaryBuyNow.price)} tone="plain" />
              <MiniStat label="Entry" value={formatUsd(primaryBuyNow.entry)} tone="green" />
              <MiniStat label="Stop" value={formatUsd(primaryBuyNow.stop)} tone="amber" />
              <MiniStat label="Target" value={formatUsd(primaryBuyNow.target)} tone="blue" />
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
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <MiniStat label="Now" value={formatUsd(buyLead.price)} tone="plain" />
                  <MiniStat label="Trigger" value={formatUsd(buyLead.trigger)} tone="green" />
                  <MiniStat label="Stop" value={formatUsd(buyLead.stop)} tone="amber" />
                  <MiniStat label="Score" value={`${buyLead.confidence}`} tone={buyLead.confidence >= 60 ? "green" : "blue"} />
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
                  </span>
                  <span className="font-mono text-xs text-slate-300">{formatUsd(item.price)}</span>
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
    <div className="h-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
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
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <MiniStat label="Entry" value={formatUsd(ticket.entry)} tone="green" />
              <MiniStat label="Stop" value={formatUsd(ticket.stop)} tone="amber" />
              <MiniStat label="Target" value={formatUsd(ticket.target)} tone="blue" />
              <MiniStat label="Units" value={`${ticket.units}`} tone="plain" />
              <MiniStat label="Max loss" value={formatUsd(ticket.maxLoss)} tone="red" />
              <MiniStat label="R/R" value={`${ticket.rewardRisk}R`} tone={ticket.rewardRisk >= 1.5 ? "green" : "red"} />
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
    <div className="h-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm shadow-black/20">
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
                  <div className="mt-1 text-xs uppercase tracking-wide text-emerald-100">{item.group}</div>
                </div>
                <span className="rounded-sm bg-emerald-300 px-2 py-1 text-xs font-bold text-slate-950">
                  Selected
                </span>
              </div>
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

function TrustOperationsTable({ gaps }: { gaps: typeof trustOperationGaps }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-white/10">
      <div className="hidden grid-cols-[1.1fr_5rem_6rem_1.2fr_1.2fr] gap-3 border-b border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase text-slate-500 lg:grid">
        <div>Missing Piece</div>
        <div>Priority</div>
        <div>Status</div>
        <div>Current State</div>
        <div>Next Action</div>
      </div>
      <div className="divide-y divide-white/10">
        {gaps.map((gap) => (
          <div key={gap.missingPiece} className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[1.1fr_5rem_6rem_1.2fr_1.2fr]">
            <div>
              <div className="font-semibold text-white">{gap.missingPiece}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{gap.whyItMatters}</div>
            </div>
            <div className="text-xs font-semibold text-slate-300">{gap.priority}</div>
            <div>
              <StatusPill status={gap.status} />
            </div>
            <div className="text-slate-400">{gap.currentState}</div>
            <div className="text-slate-300">{gap.nextAction}</div>
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
        <div className="flex h-full shrink-0 items-center gap-2 border-r border-white/10 bg-emerald-300 px-3 text-xs font-bold uppercase tracking-wide text-slate-950">
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
                    <span className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${action.className}`}>
                      {action.label}
                    </span>
                    <span className="font-semibold text-white">{quote.symbol}</span>
                    <span className="font-mono text-slate-200">{formatUsd(quote.price)}</span>
                    <span className={up ? "font-mono text-emerald-300" : "font-mono text-rose-300"}>
                      {up ? "+" : ""}
                      {quote.changePct.toFixed(2)}%
                    </span>
                    <span className="rounded-sm bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
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

function SectionTitle({ icon: Icon, title }: { icon: typeof Target; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4 text-cyan-300" />
        {label}
      </div>
      <div className="mt-2 min-h-10 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function QualityBadge({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-white">{label}</div>
        <span className={ready ? "text-xs text-emerald-300" : "text-xs text-slate-500"}>
          {ready ? "active" : "available"}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400">{value}</div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 break-words font-mono text-sm text-white">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, ready = false }: { label: string; value: string; ready?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm bg-black/20 px-2 py-2">
      <span className="text-slate-400">{label}</span>
      <span className={ready ? "text-emerald-300" : "text-amber-300"}>{value}</span>
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
  return (
    <button
      className={`rounded-md border p-3 text-left transition hover:border-white/30 ${toneClass}`}
      onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: lead.symbol }))}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/30 font-mono text-xs text-white">
              {rank}
            </span>
            <div className="font-semibold text-white">{lead.symbol}</div>
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">{lead.name}</div>
        </div>
        <span className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-emerald-300 text-slate-950" : possible ? "bg-cyan-300 text-slate-950" : "bg-slate-500/20 text-slate-300"}`}>
          {active ? "Buy Watch" : possible ? "Buy Lead" : "No Buy"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Trigger" value={formatUsd(lead.trigger)} tone={possible || active ? "green" : "plain"} />
        <MiniStat label="Stop" value={formatUsd(lead.stop)} tone="amber" />
        <MiniStat label="Target" value={formatUsd(lead.target)} tone="blue" />
        <MiniStat label="Score" value={`${lead.confidence}`} tone={lead.confidence >= 60 ? "green" : "plain"} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{lead.reason}</p>
      <div className="mt-3 text-xs text-slate-500">
        Move from open: {lead.moveFromOpenPct > 0 ? "+" : ""}
        {lead.moveFromOpenPct}% | Data: {lead.dataFresh ? "fresh" : "stale"}
      </div>
    </button>
  );
}

function SignalCard({ signal }: { signal: TradeSignal }) {
  const actionStyle =
    signal.action === "Buy Watch"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : signal.action === "Sell/Exit Watch"
        ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
        : "border-white/10 bg-white/[0.03] text-slate-300";
  const Icon = signal.action === "Buy Watch" ? TrendingUp : signal.action === "Sell/Exit Watch" ? TrendingDown : ShieldCheck;

  return (
    <div className={`rounded-md border p-3 ${actionStyle}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <div className="font-semibold text-white">{signal.symbol}</div>
          </div>
          <div className="mt-1 text-xs opacity-75">{signal.name}</div>
        </div>
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs font-semibold">{signal.action}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Price" value={formatUsd(signal.price)} tone="plain" />
        <MiniStat label="Quality" value={`${signal.quality} / ${signal.confidence}`} tone="blue" />
        <MiniStat label="Invalidation" value={formatUsd(signal.invalidation)} tone="amber" />
        <MiniStat label="R/R" value={`${signal.rewardRisk}R`} tone={signal.rewardRisk >= 1.5 ? "green" : "red"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs text-slate-200">{signal.market}</span>
        <span className="rounded-sm bg-black/20 px-2 py-1 text-xs text-slate-200">{signal.setup}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{signal.reason}</p>
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
  return (
    <div className={`rounded-md border bg-white/[0.03] ${toneClass}`}>
      <div className="border-b border-white/10 px-3 py-3 text-sm font-semibold text-white">{title}</div>
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
  return (
    <div className="rounded-md border border-cyan-300/20 bg-white/[0.03] text-cyan-100">
      <div className="border-b border-white/10 px-3 py-3 text-sm font-semibold text-white">Buy Leads</div>
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
                  <span className="rounded-sm bg-black/20 px-2 py-1">Score {lead.confidence}</span>
                </div>
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
            className={`rounded-md border p-3 text-left transition hover:border-white/30 ${algorithmTone(score.recommendation)}`}
            onClick={() => window.dispatchEvent(new CustomEvent("select-signal-symbol", { detail: score.symbol }))}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold text-white">{score.symbol}</span>
                  <span className="rounded-sm bg-black/25 px-2 py-1 text-xs font-semibold text-slate-200">
                    {score.ensembleScore}/100
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">{score.name}{score.sector ? ` | ${score.sector}` : ""}</div>
              </div>
              <span className="rounded-sm bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
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
            <MiniStat label="Max Loss" value={formatUsd(top.ticket.maxLoss)} tone="red" />
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
        <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
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

function EngineCard({ engine }: { engine: EngineCapability }) {
  const safetyClass =
    engine.safety === "Live capable, gated"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : engine.safety === "Paper trading"
        ? "border-blue-300/25 bg-blue-300/10 text-blue-100"
        : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";

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
    </div>
  );
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
  return (
    <div className="rounded-sm bg-black/20 p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`mt-1 font-mono ${color}`}>{value}</div>
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
