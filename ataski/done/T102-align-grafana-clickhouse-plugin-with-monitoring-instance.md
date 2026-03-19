---
id: T102
title: "Align Grafana ClickHouse plugin with monitoring instance"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:19:54Z
updated_at: 2026-03-19T09:21:13Z
---

## Requirements

- Align the dashboard generator defaults with the actual monitoring instance datasource plugin type `vertamedia-clickhouse-datasource`.
- Generate an instance-bound dashboard artifact for `monitoring.zeko.io` using datasource UID `dfftad89t7pxcc`.
- Keep the docs explicit about the concrete monitoring artifact and the plugin type in use.

## Test Plan

- BDD.
- RED first: confirm the current generator still defaults to `grafana-clickhouse-datasource`, which does not match the monitoring instance.
- GREEN second: regenerate both the portable dashboard and an instance-bound dashboard for `monitoring.zeko.io`, then verify the plugin type and datasource UID in the JSON.

## RED Evidence

- The generator defaulted to `grafana-clickhouse-datasource`, while the real monitoring instance uses `vertamedia-clickhouse-datasource`.
- That mismatch meant the checked-in portable dashboard still targeted the wrong plugin family for `https://monitoring.zeko.io`.

## GREEN Evidence

- Updated the default plugin type and import metadata to `vertamedia-clickhouse-datasource`.
- Regenerated `bridge-ui.analytics.dashboard.json` and verified its `__inputs` / `__requires` now target `vertamedia-clickhouse-datasource`.
- Generated `bridge-ui.analytics.monitoring.zeko.io.dashboard.json` bound to datasource UID `dfftad89t7pxcc`.
- Verified the monitoring artifact has no `__inputs` block and uses explicit datasource objects with:
  `type: "vertamedia-clickhouse-datasource"` and `uid: "dfftad89t7pxcc"`.
