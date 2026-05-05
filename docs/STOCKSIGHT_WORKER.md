# StockSight Sentiment Worker

StockSight is integrated as an optional self-hosted sentiment worker inspired by `shirosaidev/stocksight`.

## Configure

Set:

```text
STOCKSIGHT_WORKER_URL=
```

The worker should expose the existing `/api/research-workers/run` contract and accept only:

- `nlp`

## Expected Evidence

Worker responses should include:

- Symbol and requested keyword set.
- Source type: Twitter, news headline, followed link, or other text source.
- Collection timestamp and source age.
- Polarity, subjectivity, sentiment label, and model/tool used.
- Source count and any sample-size warning.
- Elasticsearch/Kibana reference if available.
- Collection limits, API/rate-limit warnings, and missing-credential warnings.

## Boundary

StockSight is Apache-2.0 licensed and can be self-hosted. Its output is sentiment/catalyst evidence only. It is not execution-grade market data, not a buy/sell signal by itself, and cannot place or authorize broker orders.

