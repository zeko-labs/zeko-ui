# Grafana Dashboard

This directory contains the Bridge UI Grafana dashboard definition generated from
the shared AE SQL templates.

## Files

- `dashboard-manifest.ts` defines the panel layout and SQL file mapping.
- `scripts/generate-dashboard.ts` renders the single working dashboard JSON and
  binds it to a Grafana datasource UID and type.
- `bridge-ui.analytics.dashboard.json` is the checked-in importable dashboard
  artifact.

## Usage

```sh
moon run bridge-ui:grafana-dashboard-generate
```

The generator resolves its datasource binding from:

- `GRAFANA_DATASOURCE_UID`
- `GRAFANA_DATASOURCE_TYPE`

If they are unset, it defaults to the current monitoring instance values.

You can still override them on the command line if needed:

```sh
node --experimental-strip-types \
./apps/bridge-ui/observability/bridge-metrics/grafana/scripts/generate-dashboard.ts \
--datasource-uid <grafana-datasource-uid> \
--datasource-type <grafana-datasource-type>
```

The checked-in dashboard JSON always binds every panel and target to:

```json
{
	"type": "vertamedia-clickhouse-datasource",
	"uid": "dfftad89t7pxcc"
}
```
