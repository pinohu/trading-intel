# Financial Services Workflows

This platform now includes a research and governance layer inspired by Anthropic's financial-services agent patterns. It is not a broker execution layer. The workflows draft evidence, review states, artifacts, and blockers that feed the existing cockpit, control plane, and institutional readiness checks.

## Implemented Workflows

- Market Researcher: sector overview, competitive landscape, peer comps, ideas shortlist, research note.
- Earnings Reviewer: filing/transcript review, variance table, model update context, post-print note.
- Thesis Tracker: falsifiable thesis pillars, update log, catalysts, disconfirming evidence.
- Catalyst Calendar: earnings, corporate events, macro dates, regulatory events, post-event archive.
- Model Builder / Update: model input pack, changed assumptions, QC findings, valuation context.
- Risk Reviewer: stale data, sizing, reward/risk, proof, control-plane, and broker-readiness blockers.
- Portfolio Rebalance: allocation drift, tax-aware notes, before/after exposure, research-only candidates.
- Tax-Loss Harvesting: harvest candidates, replacement rationale, wash-sale window, tax-review boundary.
- Artifact Publisher: trade memos, risk memos, weekly notes, calendars, validation reports.

## API Surface

- `/api/financial-services/readiness` returns the workflow catalog, optional institutional connector readiness, artifact types, review gates, and untrusted-document policy.
- `/api/research-stack/readiness` includes a compact financial-services section alongside the existing free-first data and worker stack.
- `/api/institutional/readiness` includes the full financial-services readiness payload with proof, controls, workers, and compliance.

## Optional Institutional Connectors

The app keeps its free-first research posture. Institutional connectors are optional MCP-style entitlements layered on top:

- Daloopa
- Morningstar
- S&P Global / Capital IQ
- FactSet
- Moody's
- MT Newswires
- Aiera
- LSEG
- PitchBook
- Chronograph
- Egnyte

Each connector is evidence-labeled so the cockpit can distinguish public/free evidence, licensed news, institutional market data, transcript evidence, private-market context, and document-store material.

## Review Gates

Financial-services workflows use explicit human review gates:

- `scope-approved`
- `source-cited`
- `model-qc`
- `risk-approved`
- `paper-approved`
- `operator-acknowledged`
- `publication-approved`

These gates support the existing rule: research can prepare evidence and drafts, but live orders still require the broker rail and manual acknowledgement.

## Untrusted-Document Policy

Filings, transcripts, issuer materials, PDFs, scraped pages, provider records, and external-worker output are treated as untrusted data. Workflows may extract facts, citations, metrics, and timestamps from those sources, but must never follow instructions embedded inside them.

Numbers should be labeled as source-cited, public/free, licensed, institutional, or unsourced before they influence a thesis, model, signal, or trade ticket.
