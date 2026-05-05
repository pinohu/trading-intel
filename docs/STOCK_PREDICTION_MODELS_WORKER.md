# Stock Prediction Models Worker

`huseinzol05/Stock-Prediction-Models` is integrated as an optional research-only ML model worker.

The reference repository is archived and Apache-2.0 licensed. It is useful as a model-zoo reference for:

- deep learning stock forecasts
- model stacking and ensemble comparisons
- trading simulations
- reinforcement-learning agent experiments
- TensorFlow.js-style demos
- broad model comparison and feature experiments

Configure:

```bash
STOCK_PREDICTION_MODELS_WORKER_URL=https://your-model-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `forecast`
- `backtest`
- `parameter-sweep`
- `rl-research`
- `crypto-paper`

Example dispatch:

```json
{
  "worker": "stockpredictionmodels",
  "job": {
    "jobType": "forecast",
    "symbols": ["SPY", "QQQ", "NVDA"],
    "strategy": "model-zoo-holdout-comparison",
    "parameters": {
      "lookbackDays": 1825,
      "holdoutPct": 30,
      "models": ["lstm", "cnn", "stacking", "agent"],
      "slippageBps": 5,
      "feeBps": 1
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

- model comparison metrics
- holdout and walk-forward evidence
- overfit warnings
- feature coverage
- cost/slippage assumptions
- model/version metadata

Do not route this worker to broker execution. Its output can only add or subtract research confidence inside Fusion Alpha after freshness, proof, costs, and risk controls are visible.
