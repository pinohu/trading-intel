# StockPredictionAI Worker

StockPredictionAI is integrated as an optional research-only forecast worker inspired by `borisbanushev/stockpredictionai`.

The reference repo is a notebook-style project for stock-movement prediction using ideas such as:

- GAN with an LSTM generator and CNN discriminator
- Bayesian optimization and reinforcement-learning ideas for hyperparameters
- technical indicators
- BERT-style news sentiment
- Fourier transforms and ARIMA features
- XGBoost feature importance
- stacked autoencoders and PCA/eigen portfolios

The Next.js app does not vendor or import that repository. No license file was visible in the referenced GitHub repository during integration, so copied source code should not be distributed from this codebase without legal review or explicit permission.

Configure your own worker endpoint:

```bash
STOCKPREDICTIONAI_WORKER_URL=https://your-forecast-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `forecast`
- `parameter-sweep`
- `nlp`

Example dispatch:

```json
{
  "worker": "stockpredictionai",
  "job": {
    "jobType": "forecast",
    "symbols": ["GS", "SPY", "QQQ"],
    "strategy": "gan-lstm-cnn-feature-stack",
    "parameters": {
      "lookbackDays": 2265,
      "holdoutPct": 30,
      "includeSentiment": true,
      "includeFourier": true,
      "includeArima": true,
      "includeAutoencoder": true,
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

- forecast direction and confidence
- holdout metrics
- feature importance or feature coverage
- overfit warnings
- data freshness notes
- model/version metadata

Do not let this worker place broker orders. Forecast output can raise or lower Fusion Alpha confidence only after freshness, holdout evidence, slippage/fee assumptions, and risk controls are visible.
