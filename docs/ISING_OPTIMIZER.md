# Ising Basket Optimizer

The platform includes a classical Ising/QUBO optimizer for basket selection.

It does not predict prices. It chooses the best combination of current trade candidates after the signal engine has already produced buy leads.

## What It Optimizes

The optimizer chooses binary variables:

```text
x_i = 1 means include candidate i
x_i = 0 means skip candidate i
```

It rewards:

- Higher signal score.
- Higher confidence.
- Better reward/risk.
- Trade tickets that are currently risk-valid.

It penalizes:

- Exceeding basket budget.
- Exceeding max basket risk.
- Exceeding max number of positions.
- Taking too many names from the same risk group.
- Stale or blocked trade tickets.

## Implementation

- File: `src/lib/isingOptimizer.ts`
- API: `/api/optimizer/ising`
- UI: Dashboard `Ising Basket Optimizer` panel
- Method: deterministic classical simulated annealing over QUBO-style binary variables
- No quantum hardware or external quantum package is required.

## API Example

```text
/api/optimizer/ising?symbols=NVDA,AMD,SPY,TSLA&accountSize=10000&riskPct=1&maxDailyLossPct=3&budget=3500&maxRiskDollars=300&maxPositions=3
```

The response includes:

- Selected basket.
- Rejected names.
- Reject reasons.
- Budget used.
- Risk used.
- Constraint settings.
- Diagnostics.

## Guardrail

The optimizer is a research and risk-selection tool. It does not place broker orders. Broker order placement still goes through the separate broker execution rail and its own gates.
