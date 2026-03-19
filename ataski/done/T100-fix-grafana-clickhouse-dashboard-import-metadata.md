---
id: T100
title: "Fix Grafana ClickHouse dashboard import metadata"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T08:51:36Z
updated_at: 2026-03-19T08:54:07Z
---

## Requirements

- Fix the generated dashboard import metadata so Grafana can match the datasource picker to the installed ClickHouse plugin.
- Keep the dashboard JSON and generator consistent with each other.
- Remove the misleading Altinity naming from the import metadata when the plugin ID is `grafana-clickhouse-datasource`.

## Test Plan

- BDD.
- RED first: confirm the generated dashboard currently mixes the Grafana ClickHouse plugin ID with an Altinity datasource label.
- GREEN second: regenerate the dashboard JSON and verify the import metadata is internally consistent.

## RED Evidence

- The generated dashboard JSON mixed `pluginId: "grafana-clickhouse-datasource"` with the label and requirement name `Altinity ClickHouse datasource`.
- Grafana import therefore asked the datasource picker for an Altinity datasource even though the dashboard metadata otherwise targeted the Grafana ClickHouse plugin.

## GREEN Evidence

- Updated the generator to use a single ClickHouse plugin name alongside the existing `grafana-clickhouse-datasource` plugin ID.
- Re-ran `moon run bridge-ui:grafana-dashboard-generate`.
- Verified the regenerated `bridge-ui.analytics.dashboard.json` now contains:
  `pluginId: "grafana-clickhouse-datasource"` and `pluginName: "ClickHouse"`,
  with `__requires` also naming the datasource `ClickHouse`.
