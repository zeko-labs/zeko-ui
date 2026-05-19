---
id: T213
title: "Add WEB-404 regression tests"
status: done
blockedBy: [T139, T140]
owner: codex
created_at: 2026-03-24T13:59:56Z
updated_at: 2026-03-24T14:11:41Z
---

## Requirements

- Add regression coverage for recovered-operation classification and cancellation-lane behavior.
- Verify that recovered deposits and withdrawals no longer resume in parallel.
- Verify that recovered cancellable deposits do not enter the main queue and that only one cancellation can be active at once.
- Run bridge-ui test and typecheck tasks from the repo root.

## Test Plan

- TDD
- Add pure unit tests for recovered-operation bucketing and targeted bridge-operation tests for paused cancellable deposits.

## RED Evidence

- Recovery classification, cancellation-ready status, and paused cancellable deposit behavior were previously untested.

## GREEN Evidence

- Added `recovery.test.ts`, `helpers-status.test.ts`, and expanded `bridge-operation.test.ts`
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
