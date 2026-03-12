# Grafana Dashboard

This directory contains the Bridge UI Grafana dashboard definition generated from
the shared AE SQL templates.

## Files

- `dashboard-manifest.ts` defines the panel layout and SQL file mapping.
- `scripts/generate-dashboard.ts` renders the importable dashboard JSON.
- `bridge-ui.analytics.dashboard.json` is the checked-in importable dashboard
  artifact.

## Usage

```sh
moon bridge-ui:grafana-dashboard-generate
```
