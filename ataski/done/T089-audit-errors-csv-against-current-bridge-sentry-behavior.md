---
id: T089
title: "Audit errors.csv against current bridge Sentry behavior"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T11:46:15Z
updated_at: 2026-03-12T12:13:31Z
---

## Requirements

- Audit `/Users/hebilicious/Downloads/errors.csv` against the current Bridge UI error-handling and Sentry configuration.
- Produce a classification output for every unique `(category, action, label)` tuple found in the CSV.
- For each tuple, include:
  - occurrence count
  - likely code path
  - current handling path
  - whether it should appear in Sentry
  - whether the current behavior is correct or incorrect
  - reason for that classification
- Explicitly answer the known categories from the implementation brief, including synthetic rollup events such as `bridge_operation/failed/*`.
- Store the audit under the new `sentry/` observability workspace so it can guide future instrumentation decisions.

## Test Plan

- DDD.
- RED first: derive the classification against the current code and confirm at least one class is missing an explicit capture path.
- GREEN second: finalize the audit table and verify every unique CSV tuple is accounted for exactly once.

## RED Evidence

- The initial audit confirmed that multiple AE tuples such as `bridge/findPendingOperation/Invalid witnesses data` and `transaction/sendSignedTransaction/*` had no explicit Sentry capture path even though they represent root bridge failures.
- Synthetic `bridge_operation/failed/*` rows also had to be separated from root exceptions so the audit could distinguish "should capture" from "should not capture" behavior.

## GREEN Evidence

- Added the audit generator and classification policy under `apps/bridge-ui/observability/bridge-metrics/sentry/`.
- `moon run bridge-ui:sentry-audit` now succeeds and produces both Markdown and JSON outputs from `/Users/hebilicious/Downloads/errors.csv`.
- The generated audit accounts for every unique tuple in the CSV and classifies 26 as `should-capture`, 3 as `should-not-capture`, and 1 as `needs-repro`.
