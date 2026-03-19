---
id: T098
title: "Simplify sentry observability workspace"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T17:07:01Z
updated_at: 2026-03-12T17:13:15Z
---

## Requirements

- Remove brittle and high-maintenance files from `apps/bridge-ui/observability/bridge-metrics/sentry/`.
- Delete the static classification scripts and checked-in generated audit artifacts that assume a fixed set of AE errors.
- Replace them with durable documentation focused on how to investigate current errors instead of encoding stale classifications in code.
- Remove hard-coded system paths from the Sentry workflow.

## Test Plan

- BDD.
- RED first: confirm the current Sentry workspace depends on hard-coded file paths and static error classification.
- GREEN second: verify the remaining Sentry workspace contains only durable docs and live-query tooling.

## RED Evidence

- `apps/bridge-ui/moon.yml` still pointed at `sentry-audit`, even after the audit generator was removed.
- `apps/bridge-ui/observability/bridge-metrics/README.md` still described checked-in CSV audit outputs instead of a live AE export workflow.
- The `sentry/` workspace still had stale generated artifacts and a static classification script before cleanup.

## GREEN Evidence

- Deleted the stale audit artifacts and static classification flow:
  `bridge-ae-errors.audit.json`, `bridge-ae-errors.audit.md`,
  `classify-ae-error.ts`, and `scripts/generate-audit.ts`.
- Reframed `apps/bridge-ui/observability/bridge-metrics/sentry/README.md`
  around a durable investigation workflow: generate fresh CSV, inspect tuples,
  then trace capture and filtering behavior in code.
- Updated `apps/bridge-ui/observability/bridge-metrics/README.md` and
  `apps/bridge-ui/moon.yml` so the supported Sentry flow is now the live
  `sentry-errors-csv` export instead of the deleted audit pipeline.
