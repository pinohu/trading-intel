# Dexter Financial Research Agent Worker

Dexter is integrated as an optional self-hosted financial research agent worker inspired by `virattt/dexter`.

## Configure

Set:

```text
DEXTER_WORKER_URL=
```

The worker should expose the existing `/api/research-workers/run` contract and accept only:

- `agent-research`
- `fundamentals`
- `nlp`

## Expected Evidence

Worker responses should include:

- Prompt, symbols, requested research scope, and task-plan steps.
- Tool calls, data providers, source labels, timestamps, and missing-data warnings.
- Fundamental statement or market-data fields used, with provider and period labels.
- Self-validation result, contradiction checks, uncertainty notes, and rejected claims.
- Scratchpad/run id, eval status, and links or ids for durable review artifacts.
- A clear statement that the output is research-only and cannot authorize orders.

## Free Default Path

Dexter can depend on paid or credentialed services in its own environment. The app does not require those services by default. Free/native alternatives remain:

- Native TradingAgents debate.
- Analyst Chat through `LOCAL_LLM_BASE_URL`.
- SEC EDGAR filings and CompanyFacts.
- Public quote and Yahoo RSS routes.
- Algorithm Council, AutoResearch, and cost-aware backtests.

## Boundary

Dexter is MIT licensed. Keep it self-hosted as a separate worker or service unless you intentionally vendor source with license attribution.

This bridge is financial research only. Dexter output cannot replace execution-grade quote data, cannot authorize broker orders, and cannot place paper or live orders through `/api/research-workers/run`.
