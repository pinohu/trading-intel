import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = {
  AITABLE_QUOTE_SNAPSHOTS_DATASHEET_ID: {
    name: "Trading Intel - Quote Snapshots",
    description: "Mirrored market quote snapshots from the trading intelligence platform.",
    fields: ["Record Key", "Symbol", "Name", "Price", "Change", "ChangePct", "Open", "High", "Low", "Volume", "Source", "Quality", "Provider", "MarketStatus", "ProviderUpdatedAt", "CapturedAt", "RawJson"],
  },
  AITABLE_SIGNAL_SNAPSHOTS_DATASHEET_ID: {
    name: "Trading Intel - Signal Snapshots",
    description: "Mirrored buy/sell/hold signal snapshots and scoring context.",
    fields: ["Record Key", "Symbol", "Action", "Setup", "Confidence", "Quality", "Urgency", "Price", "Invalidation", "Target", "RewardRisk", "RiskPct", "Reason", "Warnings", "Confirmations", "DataFresh", "DataAgeMinutes", "GeneratedAt", "RawJson"],
  },
  AITABLE_TRADE_TICKETS_DATASHEET_ID: {
    name: "Trading Intel - Trade Tickets",
    description: "Mirrored trade plans with entries, stops, targets, sizing, and no-trade rules.",
    fields: ["Record Key", "Symbol", "Side", "Status", "Entry", "Stop", "Target", "Units", "Notional", "MaxLoss", "RewardRisk", "RiskPct", "Tradeable", "Reason", "MustConfirm", "DoNotTradeIf", "CreatedAt", "RawJson"],
  },
  AITABLE_PAPER_TRADES_DATASHEET_ID: {
    name: "Trading Intel - Paper Trades",
    description: "Mirrored paper trades and paper broker order plans.",
    fields: ["Record Key", "Symbol", "Side", "Entry", "Stop", "Target", "Units", "MaxLoss", "Status", "Notes", "CreatedAt", "RawJson"],
  },
  AITABLE_BROKER_ORDERS_DATASHEET_ID: {
    name: "Trading Intel - Broker Orders",
    description: "Mirrored paper/live broker order requests and Alpaca responses.",
    fields: ["Record Key", "Mode", "Symbol", "AssetClass", "Side", "Qty", "OrderType", "LimitPrice", "TimeInForce", "OrderClass", "TakeProfit", "StopLoss", "ClientOrderId", "Status", "BrokerOrderId", "BrokerStatus", "LiveMoney", "CreatedAt", "RawJson"],
  },
  AITABLE_SIGNAL_OUTCOMES_DATASHEET_ID: {
    name: "Trading Intel - Signal Outcomes",
    description: "Mirrored signal outcome checks by horizon.",
    fields: ["Record Key", "SignalKey", "Symbol", "Horizon", "ObservedPrice", "ReturnPct", "HitTarget", "HitStop", "ObservedAt", "RawJson"],
  },
  AITABLE_WATCHLIST_DATASHEET_ID: {
    name: "Trading Intel - Watchlist",
    description: "Mirrored operator watchlist and notes.",
    fields: ["Record Key", "Symbol", "Name", "Market", "Enabled", "Notes", "UpdatedAt", "RawJson"],
  },
};

const env = loadEnv([
  resolve("C:/Users/VRLab/Projects/.env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
]);

const apiKey = clean(env.AITABLE_API_KEY);
if (!apiKey) {
  throw new Error("AITABLE_API_KEY was not found in C:/Users/VRLab/Projects/.env or project env files.");
}

const baseUrl = clean(env.AITABLE_BASE_URL) || "https://aitable.ai";
const spaces = await request("/fusion/v1/spaces");
const spaceList = spaces?.data?.spaces ?? [];
const selectedSpace =
  clean(env.AITABLE_SPACE_ID) ||
  spaceList.find((space) => space?.isAdmin)?.id ||
  spaceList[0]?.id;

if (!selectedSpace) {
  throw new Error("No AITable space was available for this API token.");
}

const existingNodes = await listNodes(selectedSpace).catch(() => []);
const envLines = [`AITABLE_MIRROR_ENABLED=true`, `AITABLE_SPACE_ID=${selectedSpace}`];
const created = [];
const reused = [];

for (const [envName, spec] of Object.entries(schema)) {
  const existing = existingNodes.find((node) => node?.name === spec.name && String(node?.id ?? "").startsWith("dst"));
  if (existing?.id) {
    envLines.push(`${envName}=${existing.id}`);
    reused.push({ env: envName, id: existing.id, name: spec.name });
    continue;
  }

  const response = await request(`/fusion/v1/spaces/${encodeURIComponent(selectedSpace)}/datasheets`, {
    method: "POST",
    body: JSON.stringify({
      name: spec.name,
      description: spec.description,
      fields: spec.fields.map((field) => ({ type: "Text", name: field })),
    }),
  });
  const id = response?.data?.id;
  if (!id) throw new Error(`AITable did not return a datasheet id for ${spec.name}.`);
  envLines.push(`${envName}=${id}`);
  created.push({ env: envName, id, name: spec.name });
}

console.log(JSON.stringify({ ok: true, spaceId: selectedSpace, created, reused, envLines }, null, 2));

async function listNodes(spaceId) {
  const response = await request(`/fusion/v1/spaces/${encodeURIComponent(spaceId)}/nodes`);
  const nodes = response?.data?.nodes ?? response?.data ?? [];
  return Array.isArray(nodes) ? nodes : [];
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${apiKey}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, { ...init, headers, signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok || body?.success === false) {
      throw new Error(body?.message || `AITable request failed with status ${response.status}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function loadEnv(paths) {
  const map = {};
  for (const path of paths) {
    try {
      const text = readFileSync(path, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const [key, ...rest] = line.split("=");
        map[key.trim().replace(/^\uFEFF/, "")] = clean(rest.join("="));
      }
    } catch {
      // Optional env path.
    }
  }
  return map;
}

function clean(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}
