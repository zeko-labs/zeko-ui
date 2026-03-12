---
id: T088
title: "Generate and upsert the Grafana bridge dashboard from the SQL pack"
status: done
blockedBy:
  - T086
  - T087
owner: codex
created_at: 2026-03-12T11:46:15Z
updated_at: 2026-03-12T12:13:31Z
---

## Requirements

- Create a typed panel manifest that maps dashboard panels to SQL template files and panel metadata.
- Generate `apps/bridge-ui/observability/bridge-metrics/grafana/bridge-ui.analytics.dashboard.json`.
- Generate an import-friendly dashboard JSON artifact suitable for manual Grafana UI import.
- Add a shell upsert script that injects datasource and folder values and sends the dashboard to Grafana's dashboard HTTP API with overwrite semantics.
- Keep the SQL files as the source of truth so dashboard queries and live-runner queries stay in sync.
- Cover dashboard panels for:
  - overview stats
  - events by category over time
  - events by action over time
  - latency by action
  - failure rate by action
  - route funnel
  - top error labels
  - fee retry trend
  - top routes by started events
  - transaction-step health

## Test Plan

- BDD.
- RED first: run dashboard generation before required rendered-query inputs exist and confirm generation or import validation fails clearly.
- GREEN second: generate the dashboard JSON, validate its structure, and verify API upsert formatting against Grafana's expected request body shape.

## RED Evidence

- `moon run bridge-ui:grafana-dashboard-generate` initially failed because the generator assumed a repo-root current working directory; Moon executes the task from `apps/bridge-ui`, so SQL asset resolution had to move to shared absolute runtime paths.

## GREEN Evidence

- Added the typed dashboard manifest and generator under `apps/bridge-ui/observability/bridge-metrics/grafana/`.
- `moon run bridge-ui:grafana-dashboard-generate` now succeeds and writes `bridge-ui.analytics.dashboard.json`.
- The generated dashboard artifact contains 10 panels and Grafana `__inputs`, making it suitable both for UI import and API upsert.
- Added `grafana/scripts/upsert-dashboard.sh`, which wraps the generated dashboard in Grafana's `{"dashboard": ..., "overwrite": true}` API payload and injects datasource/folder values from env.
