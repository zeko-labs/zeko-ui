---
id: T104
title: "Simplify Grafana dashboard output to env-bound artifact"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:39:31Z
updated_at: 2026-03-19T09:41:41Z
---

## Requirements

- Keep only one checked-in Grafana dashboard JSON artifact: the working datasource-bound dashboard.
- Make the dashboard generator resolve datasource UID and type from environment variables, defaulting to the monitoring instance values.
- Add those defaults to the correct `bridge-ui` env example file.
- Remove the extra monitoring-specific JSON artifact and update the docs accordingly.

## Test Plan

- BDD.
- RED first: confirm the workspace currently maintains both a generic dashboard JSON and a second monitoring-specific JSON file.
- GREEN second: regenerate the single dashboard artifact from env-backed defaults and verify it is bound to the expected datasource UID and type.

## RED Evidence

- The workspace maintained two checked-in dashboard artifacts: `bridge-ui.analytics.dashboard.json` and `bridge-ui.analytics.monitoring.zeko.io.dashboard.json`.
- The generator still supported extra multi-artifact flows instead of producing the one working dashboard by default.
- `bridge-ui` did not have an `.env.example` documenting the Grafana datasource binding.

## GREEN Evidence

- Added `apps/bridge-ui/.env.example` with `GRAFANA_DATASOURCE_UID=dfftad89t7pxcc` and `GRAFANA_DATASOURCE_TYPE=vertamedia-clickhouse-datasource`.
- Simplified `generate-dashboard.ts` so the checked-in `bridge-ui.analytics.dashboard.json` is always datasource-bound, using env vars with monitoring defaults.
- Deleted the extra `bridge-ui.analytics.monitoring.zeko.io.dashboard.json` artifact.
- Regenerated the single dashboard artifact with `moon run bridge-ui:grafana-dashboard-generate`.
