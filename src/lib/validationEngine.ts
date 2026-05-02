import { databaseConfigured, getSql } from "@/lib/db";
import { insertModelValidationReport, listModelValidationReports, modelPerformanceSummary } from "@/lib/persistence";

export type ValidationGate = {
  key: string;
  label: string;
  status: "pass" | "partial" | "fail";
  evidence: string;
  fix: string;
};

export type ValidationReport = {
  ok: boolean;
  generatedAt: string;
  grade: "green" | "amber" | "red";
  gates: ValidationGate[];
  summary: {
    passed: number;
    partial: number;
    failed: number;
  };
  storedRun?: Record<string, unknown> | null;
};

export async function buildValidationReport({ persist = false }: { persist?: boolean } = {}): Promise<ValidationReport> {
  if (!databaseConfigured()) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      grade: "red",
      gates: [
        gate("database", "Durable proof database", "fail", "DATABASE_URL is not configured.", "Configure Postgres and apply database/schema.sql."),
      ],
      summary: { passed: 0, partial: 0, failed: 1 },
    };
  }

  const [performance, proof] = await Promise.all([modelPerformanceSummary(), proofCounts()]);
  const totalSignals = Number(performance?.summary?.total_signals ?? 0);
  const outcomeChecks = (performance?.outcomes ?? []).reduce((sum, item) => sum + Number((item as { count?: unknown }).count ?? 0), 0);
  const recentReports = await listModelValidationReports(3).catch(() => []);

  const gates: ValidationGate[] = [
    gate(
      "point-in-time-fundamentals",
      "Point-in-time fundamental guard",
      proof.factorSnapshotsWithProvenance > 0 ? "partial" : "fail",
      proof.factorSnapshotsWithProvenance > 0
        ? `${proof.factorSnapshotsWithProvenance}/${proof.factorSnapshots} factor snapshots have SEC filing provenance.`
        : "No factor snapshots with filing-period provenance are stored yet.",
      "For full pass, historical factor backtests must reconstruct only filings available at each test timestamp.",
    ),
    gate(
      "outcome-attribution",
      "Signal outcome attribution",
      outcomeChecks >= 100 ? "pass" : outcomeChecks > 0 ? "partial" : "fail",
      `${outcomeChecks} stored outcome checks across ${totalSignals} signals.`,
      "Keep /api/outcomes running and require 5m, 15m, 1h, 1d, and multi-day follow-through before trusting a strategy.",
    ),
    gate(
      "walk-forward",
      "Walk-forward and out-of-sample validation",
      proof.backtestsWithValidation > 0 ? "partial" : "fail",
      proof.backtestsWithValidation > 0
        ? `${proof.backtestsWithValidation}/${proof.backtests} recent backtests include validation metadata.`
        : `${proof.backtests} backtests found, but none carry validation metadata yet.`,
      "Run current backtests after this release; new runs include holdout validation metadata.",
    ),
    gate(
      "sector-relative",
      "Sector-relative factor rank",
      proof.factorSnapshots > 0 ? "partial" : "fail",
      `${proof.factorSnapshots} factor snapshots available for sector/bucket comparison.`,
      "Expand the universe and add licensed industry classifications for full sector-relative ranking.",
    ),
    gate(
      "broker-reconciliation",
      "Broker order reconciliation",
      proof.brokerReconciliations > 0 ? "partial" : "fail",
      `${proof.brokerReconciliations} broker reconciliation runs stored.`,
      "Run /api/broker/reconcile after orders or deploy the trade-updates worker for persistent streaming.",
    ),
    gate(
      "risk-controls",
      "OMS risk controls and kill switch",
      proof.controlStateConfigured ? "pass" : "partial",
      proof.controlStateConfigured ? "Trading control state is stored." : "Default trading controls are active; no custom control state stored yet.",
      "Set explicit control-state limits and keep live trading disabled until they are reviewed.",
    ),
  ];

  const summary = summarize(gates);
  const report: ValidationReport = {
    ok: true,
    generatedAt: new Date().toISOString(),
    grade: summary.failed > 0 ? "red" : summary.partial > 0 ? "amber" : "green",
    gates,
    summary,
    storedRun: null,
  };

  if (persist) {
    report.storedRun = await insertModelValidationReport(report as unknown as Record<string, unknown>).catch((error) => ({
      error: error instanceof Error ? error.message : "Validation report storage failed.",
    }));
  } else if (recentReports.length > 0) {
    report.storedRun = recentReports[0] as Record<string, unknown>;
  }

  return report;
}

async function proofCounts() {
  const sql = getSql();
  const rows = await sql<{
    factor_snapshots: number;
    factor_snapshots_with_provenance: number;
    backtests: number;
    backtests_with_validation: number;
    broker_reconciliations: number;
    control_state_configured: boolean;
  }>`
    select
      (select count(*)::int from factor_snapshots) as factor_snapshots,
      (
        select count(*)::int
        from factor_snapshots factor
        join fundamental_snapshots fundamental on fundamental.id = factor.fundamental_snapshot_id
        where fundamental.provenance <> '{}'::jsonb
      ) as factor_snapshots_with_provenance,
      (select count(*)::int from strategy_backtests) as backtests,
      (
        select count(*)::int
        from strategy_backtests
        where assumptions ? 'validation'
      ) as backtests_with_validation,
      (select count(*)::int from broker_reconciliations) as broker_reconciliations,
      exists(select 1 from control_state where key = 'trading-controls') as control_state_configured
  `;
  const row = rows[0];
  return {
    factorSnapshots: Number(row?.factor_snapshots ?? 0),
    factorSnapshotsWithProvenance: Number(row?.factor_snapshots_with_provenance ?? 0),
    backtests: Number(row?.backtests ?? 0),
    backtestsWithValidation: Number(row?.backtests_with_validation ?? 0),
    brokerReconciliations: Number(row?.broker_reconciliations ?? 0),
    controlStateConfigured: Boolean(row?.control_state_configured),
  };
}

function gate(key: string, label: string, status: ValidationGate["status"], evidence: string, fix: string): ValidationGate {
  return { key, label, status, evidence, fix };
}

function summarize(gates: ValidationGate[]) {
  return {
    passed: gates.filter((item) => item.status === "pass").length,
    partial: gates.filter((item) => item.status === "partial").length,
    failed: gates.filter((item) => item.status === "fail").length,
  };
}
