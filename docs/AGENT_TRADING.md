# Agent Trading

The platform supports supervised agent trading:

- agents can scan markets,
- create trade proposals,
- draft bracket limit orders,
- auto-submit paper orders only when explicitly enabled,
- block live-money autonomous execution.

Live orders must still go through the human-approved broker execution rail.

## Endpoints

```text
GET  /api/agent-trader/policy
GET  /api/agent-trader/proposals
POST /api/agent-trader/execute?mode=paper
POST /api/agent-trader/execute?mode=live
```

`mode=live` always returns a blocked/manual-approval response. It includes the order draft so a human can review it, but it does not place the order.

## Optional Paper Automation

Set all of these to allow agents to submit Alpaca paper orders:

```bash
AGENT_TRADING_ENABLED=true
AGENT_PAPER_TRADING_ENABLED=true
BROKER_EXECUTION_ENABLED=true
ALPACA_PAPER_API_KEY_ID=...
ALPACA_PAPER_API_SECRET_KEY=...
```

Recommended limits:

```bash
AGENT_MIN_CONFIDENCE=75
AGENT_MAX_PROPOSALS=5
AGENT_MAX_PAPER_ORDERS_PER_RUN=1
BROKER_MAX_ORDER_NOTIONAL=5000
BROKER_MAX_ORDER_UNITS=100
```

## Start The Paper Agent Worker

```bash
npm run worker:agent-paper
```

Useful worker variables:

```bash
AGENT_PAPER_ACCOUNT_SIZE=10000
AGENT_PAPER_RISK_PCT=1
AGENT_PAPER_MAX_DAILY_LOSS_PCT=3
AGENT_PAPER_WORKER_INTERVAL_MS=60000
AGENT_PAPER_SYMBOLS=SPY,QQQ,NVDA,TSLA,AAPL,MSFT,AMD,COIN
```

The worker calls `/api/agent-trader/execute?mode=paper`. If no candidate passes the strict buy-now gate, it records the block and waits for the next poll.

## Guardrails

- No autonomous live-money trading.
- No market orders.
- No futures research aliases.
- No cron-triggered live orders.
- Paper automation still passes broker readiness, strict buy-now gates, bracket order validation, and pre-trade controls.

This keeps the agent useful as an execution assistant without letting it take irreversible financial action on its own.
