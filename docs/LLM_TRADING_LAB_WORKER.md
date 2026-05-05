# LLM Trading Lab Worker

`LuckyOne7777/LLM-Trading-Lab` is integrated as an optional research-only LLM trading experiment worker.

Use it for:

- forward-only daily LLM trading decisions
- portfolio decision logs
- hard-constraint compliance checks
- stop-loss behavior checks
- benchmark comparisons
- risk and performance metrics
- paper-only agent experiments

Configure:

```bash
LLM_TRADING_LAB_WORKER_URL=https://your-llm-trading-lab-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `agent-research`
- `portfolio`
- `backtest`
- `forecast`

Example dispatch:

```json
{
  "worker": "llmtradinglab",
  "job": {
    "jobType": "agent-research",
    "symbols": ["SPY", "QQQ", "NVDA"],
    "strategy": "forward-only-daily-agent-log",
    "parameters": {
      "benchmark": "SPY",
      "maxDrawdownPct": 10,
      "stopLossPct": 5,
      "requireConstraintAudit": true,
      "paperOnly": true
    }
  }
}
```

The app sends every worker request with:

```json
{
  "researchOnly": true,
  "noAutonomousExecution": true,
  "brokerOrdersBlocked": true
}
```

Expected worker response:

- daily decision log
- written rationale
- hard-constraint pass/fail state
- stop-loss compliance evidence
- benchmark comparison
- portfolio/risk metrics
- model and prompt metadata

License note: no root `LICENSE` file was visible during integration. This app treats the repository as a reference and worker contract only, and does not vendor or copy its source.

Do not route this worker to broker execution. Its output can only add or subtract research confidence after paper outcomes, logs, constraints, risk controls, and live-agent gates are visible.
