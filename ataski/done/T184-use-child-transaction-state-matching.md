---
id: T184
title: "Use child transaction state matching"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T10:04:50Z
updated_at: 2026-05-07T10:08:36Z
---

## Requirements

- Replace the `reportStage` parent-context bridge with idiomatic XState child actor snapshot matching.
- Add a unit test proving the Vue `useSelector` helper can follow a reactive actor ref and update when the invoked child actor changes state.
- Keep `CurrentOperation.vue` using matcher-style checks for the parent operation and the invoked `transactionMachine` child.
- Keep unrelated local endpoint changes in `apps/bridge-ui/machines/helpers.ts` untouched.

## Test Plan

- TDD: add a failing `vue-xstate` unit test that creates a reactive actor ref, switches it from `undefined` to an actor, and verifies the selected Vue ref updates as the actor transitions. Then update `useSelector` and refactor the bridge UI to select the invoked transaction child snapshot directly.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/vue-xstate.test.ts` fails because `selected.value` remains `undefined` after a reactive actor ref is assigned a started actor; `useSelector` does not resubscribe when the actor ref changes.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/vue-xstate.test.ts test/unit/transaction-machine.test.ts test/unit/bridge-operation.test.ts` passes with 9 tests.
- `moon run bridge-ui:typecheck` passes.
- `moon run bridge-ui:lint` passes.
- `moon run bridge-ui:test` passes with 57 tests.
