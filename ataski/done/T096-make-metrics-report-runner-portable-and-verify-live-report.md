---
id: T096
title: "Make metrics report runner portable and verify live report"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T16:36:41Z
updated_at: 2026-03-12T16:45:33Z
---

## Requirements

- Remove the repo-root path assumption from `run-all.sh`.
- Make the metrics report runner accept the required script and SQL locations via explicit arguments or environment so it is portable across CI and local environments.
- Keep the Moon task working by passing the necessary values from the repo configuration rather than relying on a hard-coded relative root.
- Re-run the full live metrics report and present the final report output to the user.

## Test Plan

- BDD.
- RED first: demonstrate that the current script depends on a repo-relative root assumption.
- GREEN second: run the portable script via the Moon task and directly, then execute the live metrics report successfully.

## RED Evidence

- `run-all.sh` depended on a hard-coded repo-root traversal and an optional `wrangler whoami` call rooted at a specific checkout layout, which is not portable across CI or arbitrary working directories.
- The dry-run path proved that explicit workspace wiring was missing until the script started accepting the workspace location directly.

## GREEN Evidence

- `run-all.sh` now accepts `--workspace-dir` / `BRIDGE_METRICS_WORKSPACE_DIR` and derives the SQL/query/report paths from that explicit input instead of guessing a repo root.
- The Moon tasks now pass `BRIDGE_METRICS_WORKSPACE_DIR=./observability/bridge-metrics`, so the repo workflow still works while the script remains portable for CI and direct invocation.
- Direct invocation succeeded with `BRIDGE_METRICS_WORKSPACE_DIR=./apps/bridge-ui/observability/bridge-metrics apps/bridge-ui/observability/bridge-metrics/analytics-engine/scripts/run-all.sh --dry-run`.
- The full live metrics report completed successfully with all 11 SQL files returning `ok`.
