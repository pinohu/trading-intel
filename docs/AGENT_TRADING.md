# Agent Trading

## Optimal Strategy Layer

Signals, buy leads, and buy-now candidates now carry `optimalStrategy`, a deterministic composite strategy result. It combines:

- VWAP trend continuation
- Opening-range breakout
- Failed breakout / reversal
- Catalyst momentum
- VWAP mean reversion
- Support / resistance reaction
- Trend pullback

The layer can support a buy watch, flag sell/avoid risk, ask the operator to wait, or block promotion. It never places orders. Freshness, regular-session state, liquidity, reward/risk, range quality, extended-move risk, severe weakness, and data-quality labels can veto or reduce risk before any paper or live gate sees the idea.

The platform supports supervised agent trading:

- agents can scan markets,
- create trade proposals,
- draft bracket limit orders,
- auto-submit paper orders when Alpaca paper execution is ready,
- submit live-money orders only when an operator explicitly arms the live-agent gates and acknowledges the order.

Live orders still go through the logged-in, acknowledged, audited broker execution rail.

## Endpoints

```text
GET  /api/agent-trader/policy
GET  /api/agent-trader/proposals
POST /api/agent-trader/execute?mode=paper
POST /api/agent-trader/execute?mode=live
```

`mode=live` places a real-money order only when all live-agent gates pass. Otherwise it returns a blocked/manual-approval response with the draft and missing gates.

## Paper Automation

Paper-agent automation is on by default unless either agent flag is set to `false`. Set these broker values so agents can submit Alpaca paper orders:

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

Production Vercel runs `/api/agent-trader/paper-run` every 5 minutes. That route uses `CRON_SECRET`, calls the in-app `/api/agent-trader/execute?mode=paper` endpoint, and only submits a paper bracket-limit order when the strict buy-now gate, broker readiness, and pre-trade controls all pass.

For a local long-running worker, use:

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

## Enable Live Agent Trading

Live agent trading is off by default. To make it available whenever you choose to arm it, configure the live broker rail and then set the live-agent controls:

```bash
BROKER_EXECUTION_ENABLED=true
ALPACA_LIVE_TRADING_ENABLED=true
ALPACA_LIVE_API_KEY_ID=...
ALPACA_LIVE_API_SECRET_KEY=...
BROKER_LIVE_EXECUTION_ACK=...
DATABASE_URL=...
AGENT_LIVE_TRADING_ENABLED=true
CONTROL_ALLOW_LIVE_ORDERS=true
CONTROL_ALLOW_LIVE_AGENT_ORDERS=true
TRADING_KILL_SWITCH=false
AGENT_MAX_LIVE_ORDERS_PER_RUN=1
```

You can also arm or disarm live-agent trading through `POST /api/control-plane` with `allowLiveAgentOrders`. Each live request must still come from a logged-in user session, set `confirmLiveAgentTrading=true`, include the matching `liveAcknowledgement`, pass broker readiness, create an audit row, and pass pre-trade controls.

Cron, bearer, and worker requests cannot submit live-money agent orders.

## Guardrails

- Live-money agent trading is locked until explicitly armed.
- No market orders.
- No futures research aliases.
- No cron-triggered live orders.
- Paper and live automation still pass broker readiness, strict buy-now gates, bracket order validation, and pre-trade controls.

This keeps the agent useful as an execution assistant while giving you an explicit, auditable way to enable or disable real-money agent trading.
