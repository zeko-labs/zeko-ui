# Metrics SQL Pack

The SQL files in `sql/` are the source of truth for both live metrics reports and
the Grafana dashboard queries.

## Usage

- Dry run render:

```sh
moon bridge-ui:metrics-report
```

- Live metrics report:

```sh
CLOUDFLARE_API_TOKEN=... moon bridge-ui:metrics-report-live
```

- Direct script invocation:

```sh
BRIDGE_METRICS_WORKSPACE_DIR=/absolute/path/to/apps/bridge-ui/observability/bridge-metrics \
./analytics-engine/scripts/run-all.sh --dry-run
```

## SQL Template Rules

- `{{dataset}}` resolves to `AE_DATASET`, defaulting to `bridge_metrics`.
- `{{time_filter:<window>}}` resolves to either:
  - a concrete AE SQL predicate in live mode
  - `$timeFilter` in Grafana mode
