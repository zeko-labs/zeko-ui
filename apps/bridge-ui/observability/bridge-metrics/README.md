# Bridge Metrics Observability

This workspace contains the Bridge UI observability tooling built around the
Cloudflare Analytics Engine `bridge_metrics` dataset.

## Layout

- `analytics-engine/` contains the runnable SQL templates, the live report
  runner, and the Markdown formatter.
- `grafana/` contains the typed dashboard manifest and the generated importable
  dashboard JSON.
- `sentry/` contains the CSV audit output and the current bridge Sentry capture
  policy.
- `lib/` contains shared TypeScript helpers used by the AE runner and the
  Grafana dashboard generator.

## Environment

- `CLOUDFLARE_ACCOUNT_ID` defaults to `a12d2915bc16ee8550f19399839623f7`
- `CLOUDFLARE_API_TOKEN` is required for live AE queries
- `AE_DATASET` defaults to `bridge_metrics`

## Common Commands

- `moon bridge-ui:metrics-report` renders every SQL file and prints a dry-run
  metrics report.
- `moon bridge-ui:metrics-report-live` runs every SQL file against the live AE
  SQL API and prints a Markdown metrics report.
- `moon bridge-ui:grafana-dashboard-generate` regenerates the importable
  dashboard JSON.
- `moon bridge-ui:sentry-audit` regenerates the CSV audit outputs.

## Direct Script Usage

- `BRIDGE_METRICS_WORKSPACE_DIR=/absolute/path/to/apps/bridge-ui/observability/bridge-metrics ./analytics-engine/scripts/run-all.sh --dry-run`
- `BRIDGE_METRICS_WORKSPACE_DIR=/absolute/path/to/apps/bridge-ui/observability/bridge-metrics CLOUDFLARE_API_TOKEN=... ./analytics-engine/scripts/run-all.sh`
