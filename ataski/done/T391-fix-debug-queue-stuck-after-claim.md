---
id: T391
title: "fix-debug-queue-stuck-after-claim"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:29:20Z
updated_at: 2026-06-19T06:34:52Z
---

## Requirements

- Remove Clear Completed from bridge debug mode; testers can refresh the page instead.
- Delete the misleading recovery unit test added for Bug 1 because it does not reproduce the observed UI state.
- Treat Bug 1 as still unresolved in `BUGS.md`: after claiming a deposit, completed transactions increment but the main lane can remain stuck on the claimed deposit with Claim disabled, and the next operation does not become current.
- Verify this is not introduced by debug mode before changing bridge logic. Debug mode must not hide, invent, or compensate for bridge state bugs.
- Add a durable project instruction so future bridge-ui bug work first distinguishes actual bridge logic from debug-mode behavior.

## Test Plan

- BDD/TDD where meaningful. Remove the false-positive recovery test first because it encoded the wrong state transition.
- Add or update tests only if they exercise the actual actor/view path that can leave the claimed operation in the main lane; do not add narrow tests that merely prove an implementation helper.
- GREEN requires focused bridge-ui validation for affected debug and bridge state files, plus bridge-ui lint/typecheck/test.

## Test Strategy Exception

- The first source edit deletes a known-misleading regression test and removes a debug-only Clear Completed control. Writing a RED test for those removals would preserve the false confidence the user explicitly rejected. The replacement validation will use targeted existing tests and any new test only after the real actor/UI failure path is identified.

## RED Evidence

- The previous `does not let locally completed operations block the recovered main queue head` recovery test is invalid evidence for the observed bug: the UI remains stuck on the claimed operation even though completed transactions increment, which is a parent/view state problem rather than the helper-only recovery case covered by that test.
- `moon run bridge-ui:test -- test/unit/bridge-current-operation.test.ts` failed before the fix: `Bridge.vue` rendered `<CurrentOperation v-else :operation="currentOperation" />` without `:key="currentOperation.id"`, allowing stale actor subscriptions when the active operation actor changes.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/bridge-current-operation.test.ts` passed: 1 test.
- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 4 tests.
- `moon run bridge-ui:test -- test/unit/recovery.test.ts` passed: 10 tests.
- `moon run bridge-ui:lint` passed: Biome checked 107 files with no fixes.
- `git diff --check` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 26 files, 136 tests.
