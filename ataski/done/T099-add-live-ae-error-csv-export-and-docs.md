---
id: T099
title: "Add live AE error CSV export and docs"
status: done
blockedBy:
  - T098
owner: codex
created_at: 2026-03-12T17:07:01Z
updated_at: 2026-03-12T17:13:15Z
---

## Requirements

- Add a live Analytics Engine SQL query dedicated to exporting current bridge error tuples as CSV.
- Provide a portable script for generating that CSV on demand from AE instead of relying on manually downloaded `errors.csv`.
- Document exactly how to use the scripts, what environment/arguments they require, and how a future user or agent should investigate new errors.
- Keep the tooling generic enough that new error tuples do not require code changes.

## Test Plan

- BDD.
- RED first: confirm the current workflow cannot regenerate `errors.csv` from the repo itself.
- GREEN second: run the new export flow and verify it produces a fresh CSV from AE along with clear usage docs.

## RED Evidence

- The repo could not regenerate `errors.csv` from source; the prior workflow depended on a manually downloaded CSV and a checked-in classification layer.
- There was no supported Moon entrypoint for exporting fresh AE error tuples as CSV.

## GREEN Evidence

- Added `apps/bridge-ui/observability/bridge-metrics/sentry/errors-export.sql`
  as the source-of-truth AE query for current error tuples.
- Added `apps/bridge-ui/observability/bridge-metrics/sentry/scripts/export-errors-csv.ts`
  to run that query live and print CSV to stdout or `--output`.
- Added `moon run bridge-ui:sentry-errors-csv`, then verified it live against
  Analytics Engine. The current export starts with:
  `bridge_operation,failed,unknown error,46`
  and `bridge_operation,submitDeposit,Cannot start new transaction within another transaction,21`.
- Re-ran `moon run bridge-ui:metrics-report-live` and confirmed all 11 SQL files
  returned `ok`.
