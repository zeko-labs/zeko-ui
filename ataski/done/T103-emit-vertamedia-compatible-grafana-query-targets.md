---
id: T103
title: "Emit Vertamedia-compatible Grafana query targets"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:30:44Z
updated_at: 2026-03-19T09:31:37Z
---

## Requirements

- Update the Grafana dashboard generator to emit the actual query target schema expected by `vertamedia-clickhouse-datasource`.
- Stop using Grafana generic SQL target fields such as `rawSql`, numeric `format`, `queryType`, and `editorType`.
- Ensure Grafana-mode SQL uses time filtering that does not rely on missing query-builder metadata.
- Regenerate both the portable dashboard and the monitoring-bound dashboard with the corrected target model.

## Test Plan

- BDD.
- RED first: confirm the current generated dashboard uses generic Grafana SQL target fields that do not exist in the Vertamedia plugin model.
- GREEN second: regenerate the dashboards and verify targets use `query`, string `format`, SQL editor defaults, and Vertamedia-compatible time filtering.

## RED Evidence

- The generated dashboard targets used Grafana generic SQL fields like `rawSql`, numeric `format`, `queryType`, and `editorType`.
- The Vertamedia plugin source defines a different query model with SQL stored in `query`, string `format`, and SQL-editor state fields.
- Grafana-mode SQL used `$timeFilter`, but the Vertamedia docs require builder metadata for that macro; our generated targets did not provide a date column configuration.

## GREEN Evidence

- Updated the generator to emit Vertamedia-compatible targets with `query`, `format: "table" | "time_series"`, `editorMode: "sql"`, `datasourceMode: "Datasource"`, and the plugin defaults expected by the SQL editor.
- Updated Grafana SQL rendering so `{{time_filter:*}}` becomes `$timeFilterByColumn(timestamp)` instead of `$timeFilter`.
- Regenerated both `bridge-ui.analytics.dashboard.json` and `bridge-ui.analytics.monitoring.zeko.io.dashboard.json`.
- Verified the monitoring dashboard now contains no `rawSql` / `queryType` / numeric `format` fields, and its queries use `$timeFilterByColumn(timestamp)`.
