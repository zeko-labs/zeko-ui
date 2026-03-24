# Bridge Metrics Observability

This workspace contains the Bridge UI observability tooling built around the
Cloudflare Analytics Engine `bridge_metrics` dataset.

## Layout

- `analytics-engine/` contains the runnable SQL templates, the live report
  runner, and the Markdown formatter.
- `grafana/` contains the typed dashboard manifest and the generated importable
  dashboard JSON.
- `sentry/` contains the live AE error export query, the CSV export script, and
  the current bridge Sentry investigation guide.
- `lib/` contains shared TypeScript helpers used by the AE runner and the
  Grafana dashboard generator.

## Environment

- `CLOUDFLARE_ACCOUNT_ID` defaults to `a12d2915bc16ee8550f19399839623f7`
- `CLOUDFLARE_API_TOKEN` is required for live AE queries
- `AE_DATASET` defaults to `bridge_metrics`
- `GRAFANA_DATASOURCE_UID` defaults to `dfftad89t7pxcc`
- `GRAFANA_DATASOURCE_TYPE` defaults to `vertamedia-clickhouse-datasource`

## Common Commands

- `moon run bridge-ui:metrics-report` renders every SQL file and prints a dry-run
  metrics report.
- `moon run bridge-ui:metrics-report-live` runs every SQL file against the live AE
  SQL API and prints a Markdown metrics report.
- `moon run bridge-ui:grafana-dashboard-generate` regenerates the importable
  dashboard JSON.
- `moon run bridge-ui:sentry-errors-csv` exports the current AE error tuples as CSV.

## Direct Script Usage

Run these from the repo root:

- `./apps/bridge-ui/observability/bridge-metrics/analytics-engine/scripts/run-all.sh --workspace-dir ./apps/bridge-ui/observability/bridge-metrics --dry-run`
- `CLOUDFLARE_API_TOKEN=... ./apps/bridge-ui/observability/bridge-metrics/analytics-engine/scripts/run-all.sh --workspace-dir ./apps/bridge-ui/observability/bridge-metrics`
- `CLOUDFLARE_API_TOKEN=... node --experimental-strip-types ./apps/bridge-ui/observability/bridge-metrics/sentry/scripts/export-errors-csv.ts --window 7d`
