---
id: T424
title: "fix-dashboard-pending-anchor-warning"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-20T07:50:29Z
updated_at: 2026-06-20T07:53:21Z
---

## Requirements

- Fix the Actions Dashboard finality probe so it warns when `commitAsePastSlot` returns a pending commit anchor with an empty `ase` tail.
- Preserve the existing dashboard finality warning behavior for non-empty pending tails.
- Keep the change scoped to dashboard finality diagnostics and focused test coverage.

## Test Plan

- TDD: add a failing unit test in `apps/actions-dashboard/test/ops.test.ts` for a pending commit anchor where `markedAsCanonicalAt` is missing/null and `ase` is empty. The expected behavior is warning status with `pendingOuterTailCount` including that pending commit.

## RED Evidence

- `moon run actions-dashboard:test -f -- test/ops.test.ts -t "warns when the actions API finality anchor is itself pending"` failed as expected: the probe returned `status: ok` with `pendingOuterTailCount: 0` for a pending commit anchor.

## GREEN Evidence

- `moon run actions-dashboard:test -f -- test/ops.test.ts -t "warns when the actions API finality anchor is itself pending"` passed.
- `moon run actions-dashboard:test actions-dashboard:typecheck -f` passed: 38 dashboard tests and Nuxt typecheck.
