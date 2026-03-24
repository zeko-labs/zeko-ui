---
id: T092
title: "Fix non-Error metric labels and Sentry audit"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T14:10:05Z
updated_at: 2026-03-12T14:20:58Z
---

## Requirements

- Stop emitting `[object Object]` for handled bridge metrics and Sentry capture paths when the thrown value is a non-Error object.
- Reuse the richer bridge error description so Analytics Engine labels and Sentry grouping both preserve useful detail.
- Update the audit/classification output so the previous `[object Object]` bucket is reclassified based on the improved error description strategy.
- Add or update automated tests that cover the non-Error object path.

## Test Plan

- TDD.
- RED first: codify the current bad `[object Object]` behavior in a focused unit test.
- GREEN second: route non-Error objects through the richer description path and verify the updated tests and audit outputs pass.

## RED Evidence

- `transaction / signTransaction / [object Object]` was still being emitted because handled non-Error objects fell back to `String(error)` in metric labeling.
- The previous audit therefore treated that tuple as ambiguous instead of calling it the serialization bug it actually is.

## GREEN Evidence

- `createLogger.act()` now uses the richer bridge error description for failed metrics, so structured thrown objects no longer collapse to `[object Object]`.
- Added unit coverage for structured non-Error object serialization and updated the audit classification to treat the historical `[object Object]` bucket as an incorrect capture bug.
- `moon run bridge-ui:sentry-audit` now regenerates outputs with 27 `should-capture` tuples and 3 `should-not-capture` tuples.
- `moon run bridge-ui:test` passes with the updated bridge-sentry and audit tests.
