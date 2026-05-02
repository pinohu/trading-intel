import { afterEach, describe, expect, it } from "vitest";
import { brokerConfig, validateBrokerOrderPayload } from "@/lib/broker";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("broker", () => {
  it("defaults to a locked paper broker rail", () => {
    delete process.env.BROKER_EXECUTION_ENABLED;
    delete process.env.BROKER_EXECUTION_MODE;
    delete process.env.ALPACA_API_KEY_ID;
    delete process.env.ALPACA_API_SECRET_KEY;
    delete process.env.ALPACA_PAPER_API_KEY_ID;
    delete process.env.ALPACA_PAPER_API_SECRET_KEY;
    delete process.env.ALPACA_LIVE_API_KEY_ID;
    delete process.env.ALPACA_LIVE_API_SECRET_KEY;

    const config = brokerConfig();

    expect(config.mode).toBe("paper");
    expect(config.executionEnabled).toBe(false);
    expect(config.credentialsConfigured).toBe(false);
  });

  it("keeps paper and live credentials separated", () => {
    process.env.BROKER_EXECUTION_MODE = "paper";
    process.env.ALPACA_API_KEY_ID = "generic-paper-key";
    process.env.ALPACA_API_SECRET_KEY = "generic-paper-secret";

    expect(brokerConfig("paper").credentialsConfigured).toBe(true);
    expect(brokerConfig("live").credentialsConfigured).toBe(false);

    process.env.BROKER_EXECUTION_MODE = "live";
    process.env.ALPACA_PAPER_API_KEY_ID = "paper-key";
    process.env.ALPACA_PAPER_API_SECRET_KEY = "paper-secret";
    process.env.ALPACA_LIVE_API_KEY_ID = "live-key";
    process.env.ALPACA_LIVE_API_SECRET_KEY = "live-secret";

    expect(brokerConfig("paper").credentialsConfigured).toBe(true);
    expect(brokerConfig("live").credentialsConfigured).toBe(true);
  });

  it("accepts only whole-share day limit stock/ETF orders inside risk caps", () => {
    process.env.BROKER_MAX_ORDER_NOTIONAL = "1000";
    process.env.BROKER_MAX_ORDER_UNITS = "20";

    const result = validateBrokerOrderPayload({
      symbol: "SPY",
      side: "buy",
      qty: 2,
      type: "limit",
      limitPrice: 500,
      timeInForce: "day",
      clientOrderId: "ticket-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.symbol).toBe("SPY");
      expect(result.order.clientOrderId).toBe("ticket-1");
    }
  });

  it("rejects market orders, futures aliases, fractional shares, and oversized notional", () => {
    process.env.BROKER_MAX_ORDER_NOTIONAL = "1000";

    expect(validateBrokerOrderPayload({ symbol: "SPY", side: "buy", qty: 1, type: "market", limitPrice: 500, timeInForce: "day" }).ok).toBe(false);
    expect(validateBrokerOrderPayload({ symbol: "OIL", side: "buy", qty: 1, type: "limit", limitPrice: 70, timeInForce: "day" }).ok).toBe(false);
    expect(validateBrokerOrderPayload({ symbol: "SPY", side: "buy", qty: 0.5, type: "limit", limitPrice: 500, timeInForce: "day" }).ok).toBe(false);
    expect(validateBrokerOrderPayload({ symbol: "SPY", side: "buy", qty: 3, type: "limit", limitPrice: 500, timeInForce: "day" }).ok).toBe(false);
  });

  it("requires the live acknowledgement phrase in live mode", () => {
    process.env.BROKER_EXECUTION_MODE = "live";
    process.env.BROKER_LIVE_EXECUTION_ACK = "I ACCEPT LIVE RISK";

    expect(validateBrokerOrderPayload({ symbol: "SPY", side: "buy", qty: 1, type: "limit", limitPrice: 500, timeInForce: "day" }).ok).toBe(false);
    expect(validateBrokerOrderPayload({ symbol: "SPY", side: "buy", qty: 1, type: "limit", limitPrice: 500, timeInForce: "day", acknowledgement: "I ACCEPT LIVE RISK" }).ok).toBe(true);
  });

  it("accepts guarded bracket orders only when stop and target are on the correct side", () => {
    const valid = validateBrokerOrderPayload({
      symbol: "AAPL",
      side: "buy",
      qty: 2,
      type: "limit",
      limitPrice: 200,
      orderClass: "bracket",
      takeProfitLimitPrice: 206,
      stopLossStopPrice: 196,
      clientOrderId: "bracket-1",
    });
    const invalid = validateBrokerOrderPayload({
      symbol: "AAPL",
      side: "buy",
      qty: 2,
      type: "limit",
      limitPrice: 200,
      orderClass: "bracket",
      takeProfitLimitPrice: 198,
      stopLossStopPrice: 202,
    });

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
  });

  it("normalizes crypto symbols while keeping crypto order rules separate", () => {
    const result = validateBrokerOrderPayload({
      symbol: "BTCUSD",
      assetClass: "crypto",
      side: "buy",
      qty: 0.01,
      type: "limit",
      limitPrice: 65000,
      timeInForce: "gtc",
      clientOrderId: "crypto-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.symbol).toBe("BTC/USD");
      expect(result.order.timeInForce).toBe("gtc");
    }
  });
});
