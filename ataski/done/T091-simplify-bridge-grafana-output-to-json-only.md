---
id: T091
title: "Simplify bridge Grafana output to JSON only"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T14:10:05Z
updated_at: 2026-03-12T14:20:58Z
---

## Requirements

- Remove the Grafana API upsert CLI flow and any Grafana-specific environment variable handling from the bridge observability tooling.
- Keep the generated Grafana dashboard JSON artifact as the supported output for now.
- Update any docs, runtime helpers, and Moon tasks so the workflow only advertises generating the importable dashboard JSON.
- Preserve the existing dashboard generator and generated JSON file.

## Test Plan

- TDD.
- RED first: confirm the previous Grafana upsert flow is no longer a supported or referenced path.
- GREEN second: regenerate the dashboard JSON and verify the remaining tooling still works without Grafana env configuration.

## RED Evidence

- The checked-in tooling still exposed `grafana-dashboard-upsert`, Grafana upsert env vars, and API-payload generation even though the JSON artifact alone is sufficient for the current workflow.

## GREEN Evidence

- Removed the Grafana API upsert script and the `grafana-dashboard-upsert` Moon task.
- Simplified the dashboard generator to emit only the importable JSON artifact and removed Grafana env resolution from the shared runtime helper.
- `moon run bridge-ui:grafana-dashboard-generate` succeeds and rewrites `bridge-ui.analytics.dashboard.json` without any Grafana env configuration.
