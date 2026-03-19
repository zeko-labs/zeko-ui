# Metrics SQL Pack

The SQL files in `sql/` are the source of truth for both live metrics reports and
the Grafana dashboard queries.

## Usage

- Dry run render:

```sh
moon run bridge-ui:metrics-report
```

- Live metrics report:

```sh
CLOUDFLARE_API_TOKEN=... moon run bridge-ui:metrics-report-live
```

- Direct script invocation:

```sh
./apps/bridge-ui/observability/bridge-metrics/analytics-engine/scripts/run-all.sh \
  --workspace-dir ./apps/bridge-ui/observability/bridge-metrics \
  --dry-run
```

## SQL Template Rules

- `{{dataset}}` resolves to `AE_DATASET`, defaulting to `bridge_metrics`.
- `{{time_filter:<window>}}` resolves to either:
  - a concrete AE SQL predicate in live mode
  - `$timeFilter` in Grafana mode
