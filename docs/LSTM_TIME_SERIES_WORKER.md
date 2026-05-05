# LSTM Time Series Worker

`jaungiers/LSTM-Neural-Network-for-Time-Series-Prediction` is integrated as an optional research-only LSTM forecast worker.

Use it for:

- sequence-window LSTM baseline forecasts
- train/test split checks
- walk-forward or holdout validation
- benchmark comparisons against naive trend/buy-hold baselines
- dependency drift warnings for older Keras/TensorFlow stacks
- forecast uncertainty and overfit diagnostics

Configure:

```bash
LSTM_TIME_SERIES_WORKER_URL=https://your-lstm-time-series-worker.example.com/run
WORKER_SHARED_SECRET=optional-shared-secret
```

Accepted job families:

- `forecast`
- `parameter-sweep`
- `backtest`

Example dispatch:

```json
{
  "worker": "lstmtimeseries",
  "job": {
    "jobType": "forecast",
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "strategy": "lstm-sequence-holdout",
    "parameters": {
      "sequenceLength": 50,
      "lookbackDays": 1460,
      "holdoutPct": 30,
      "walkForwardSplits": 5,
      "compareToNaiveBaseline": true,
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
- sequence length and feature set
- train/test split or walk-forward metadata
- holdout metrics
- naive baseline comparison
- overfit warnings
- dependency/version warnings
- model artifact/version metadata

License note: the upstream repo is AGPL-3.0 licensed. This app treats it as a separately hosted reference/worker contract and does not vendor or copy its source.

Do not route this worker to broker execution. Its output can only add or subtract research confidence after freshness, holdout proof, benchmark comparison, slippage/fee assumptions, and risk controls are visible.
