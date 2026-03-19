---
id: T086
title: "Scaffold bridge observability workspace and AE runner contract"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T11:46:15Z
updated_at: 2026-03-12T12:13:31Z
---

## Requirements

- Create a repo-managed observability workspace under `apps/bridge-ui/observability/bridge-metrics/`.
- Define the canonical subdirectories for `analytics-engine/`, `grafana/`, and `sentry/`.
- Add shared config/runtime contracts for:
  - `CLOUDFLARE_ACCOUNT_ID` defaulting to `a12d2915bc16ee8550f19399839623f7`
  - `CLOUDFLARE_API_TOKEN`
  - `AE_DATASET` defaulting to `bridge_metrics`
  - `GRAFANA_URL`
  - `GRAFANA_API_TOKEN`
  - `GRAFANA_DATASOURCE_UID`
  - optional `GRAFANA_FOLDER_UID`
- Add a shell entrypoint for live AE reporting plus checked-in TypeScript helper entrypoints used by the runner and dashboard generation.
- Add a smoke-query path and fail-fast checks for auth, account, and dataset reachability before any report query runs.
- Add Moon tasks in `apps/bridge-ui/moon.yml` for the observability tooling.

## Test Plan

- TDD.
- RED first: add or run the new AE report tooling in a state where required files or auth checks are missing and confirm it fails with an actionable message.
- GREEN second: run the scaffolding commands and confirm the smoke path executes far enough to validate environment and dataset wiring.

## RED Evidence

- `moon run bridge-ui:ae-report-live` failed fast with `CLOUDFLARE_API_TOKEN is required for live AE queries.` before the final runner contract was wired for clear env validation.
- Early `moon run bridge-ui:ae-report` attempts also exposed that the runner needed script-relative path resolution instead of relying on the current working directory under Moon.

## GREEN Evidence

- Added the repo-managed workspace under `apps/bridge-ui/observability/bridge-metrics/` with shared runtime/sql helpers plus `analytics-engine/`, `grafana/`, and `sentry/` subareas.
- `moon run bridge-ui:ae-report` now succeeds and renders the dry-run Markdown report from the shared SQL pack.
- `moon run bridge-ui:ae-report-live` now succeeds end-to-end against the Zeko account with all query files passing.
- Added Moon tasks in `apps/bridge-ui/moon.yml` for `ae-report`, `ae-report-live`, `grafana-dashboard-generate`, `grafana-dashboard-upsert`, and `sentry-audit`.
