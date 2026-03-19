---
id: T087
title: "Author and live-validate the bridge AE SQL pack"
status: done
blockedBy:
  - T086
owner: codex
created_at: 2026-03-12T11:46:15Z
updated_at: 2026-03-12T12:13:31Z
---

## Requirements

- Create one AE SQL template file per required query under `apps/bridge-ui/observability/bridge-metrics/analytics-engine/sql/`.
- Required files:
  - `00_smoke_dataset.sql`
  - `01_action_inventory.sql`
  - `02_events_by_category_timeseries.sql`
  - `03_events_by_action_timeseries.sql`
  - `04_latency_by_action.sql`
  - `05_failure_rate_by_action.sql`
  - `06_route_funnel.sql`
  - `07_error_labels.sql`
  - `08_fee_retry_timeseries.sql`
  - `09_routes_by_started.sql`
  - `10_transaction_step_health.sql`
- Use only AE-compatible syntax already confirmed in this repository investigation:
  - `_sample_interval`-weighted aggregations
  - `sumIf`
  - `if`
  - `intDiv(toUInt32(timestamp), ...)`
  - `quantileExactWeighted`
- Support rendering in both live-runner mode and Grafana mode from the same source SQL.
- Validate every rendered query against the live Cloudflare SQL API for the Zeko account.

## Test Plan

- BDD.
- RED first: run the live SQL pack with at least one intentionally incomplete or invalid query and confirm the runner reports the failing file and API error.
- GREEN second: run the full SQL pack against the live dataset and require zero query failures.

## RED Evidence

- Live AE validation surfaced query-shape problems during iteration, including unsupported syntax and route-funnel grouping that did not produce the intended bridge lifecycle summary until the SQL pack was rewritten around AE-safe primitives.
- The AE runner now preserves per-file failures, which was used while iterating on the templates until every query rendered and executed cleanly.

## GREEN Evidence

- Added all required SQL templates under `apps/bridge-ui/observability/bridge-metrics/analytics-engine/sql/`.
- `moon run bridge-ui:ae-report-live` completed successfully with all 11 SQL files returning `ok` against `bridge_metrics` in account `a12d2915bc16ee8550f19399839623f7`.
- The validated report confirmed weighted counts, latency, route funnel, error labels, fee retry trend, and transaction-step health from the same source SQL used by Grafana generation.
