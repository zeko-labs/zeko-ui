---
id: T090
title: "Implement bridge Sentry capture strategy for handled machine errors"
status: done
blockedBy:
  - T089
owner: codex
created_at: 2026-03-12T11:46:15Z
updated_at: 2026-03-12T12:13:31Z
---

## Requirements

- Add explicit Sentry capture for handled bridge errors that are currently converted into XState transitions, stored on machine context, or surfaced only as user toasts.
- Preserve the existing intentional filters for:
  - `QuietError`
  - wallet rejection flows
  - browser extension noise
  - aborted requests
  - third-party-only stack traces
- Normalize and fingerprint repeated backend/data errors so high-cardinality payloads, especially `rangeCheckN` values, group meaningfully in Sentry.
- Enrich captured events with observability context such as bridge category, action, direction, source network, destination network, and wallet/account availability where applicable.
- Ensure synthetic lifecycle rollups like `bridge_operation/failed/*` do not create duplicate top-level Sentry noise when a root cause has already been captured.
- Add automated tests for any new normalization/classification helpers and for any new explicit capture guards that can be tested locally.

## Test Plan

- TDD.
- RED first: add failing unit coverage for normalization and for the missing handled-error capture behavior discovered in T089.
- GREEN second: implement the capture strategy and run the relevant bridge UI tests to prove the new logic works without breaking the existing filters.

## RED Evidence

- The T089 audit established the failing behavior: handled bridge exceptions were present in AE but absent from Sentry because metric recording rethrew into XState without any explicit capture step.
- Targeted unit coverage was added for normalization and capture gating so the missing handled-error path had a concrete local regression harness before the bridge Sentry helper was wired in.

## GREEN Evidence

- Added `machines/bridge-sentry.ts` plus tests covering normalization, fingerprinting, and capture guards.
- Updated the bridge metrics logger so `act()`-recorded handled exceptions now emit both AE metrics and explicit Sentry captures with bridge/action/route context while preserving existing Sentry filters.
- `moon run bridge-ui:test` and `moon run bridge-ui:typecheck` both pass with the new bridge Sentry capture path in place.
