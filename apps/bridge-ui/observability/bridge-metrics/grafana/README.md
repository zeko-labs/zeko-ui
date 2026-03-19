# Grafana Dashboard

This directory contains the Bridge UI Grafana dashboard definition generated from
the shared AE SQL templates.

## Files

- `dashboard-manifest.ts` defines the panel layout and SQL file mapping.
- `scripts/generate-dashboard.ts` renders either:
  - a portable import JSON that uses Grafana's datasource picker
  - an instance-bound import JSON that hardcodes a datasource UID and type
- `bridge-ui.analytics.dashboard.json` is the checked-in importable dashboard
  artifact.

## Usage

```sh
moon bridge-ui:grafana-dashboard-generate
```

For a guaranteed import path that does not depend on Grafana matching the
datasource through the import picker, generate an instance-bound artifact:

```sh
node --experimental-strip-types \
./apps/bridge-ui/observability/bridge-metrics/grafana/scripts/generate-dashboard.ts \
--datasource-uid <grafana-datasource-uid> \
--datasource-type grafana-clickhouse-datasource \
--output ./apps/bridge-ui/observability/bridge-metrics/grafana/bridge-ui.analytics.bound.dashboard.json
```

`--output` is resolved relative to your current shell directory, so the example
above is meant to be run from the repo root.

You can get the datasource UID from Grafana by opening the datasource settings
page and copying the final path segment from the URL, which usually looks like:

```text
/connections/datasources/edit/<datasource-uid>
```

That output will bind every panel and target to:

```json
{
	"type": "grafana-clickhouse-datasource",
	"uid": "<grafana-datasource-uid>"
}
```

and will omit the `__inputs` datasource picker block entirely.
