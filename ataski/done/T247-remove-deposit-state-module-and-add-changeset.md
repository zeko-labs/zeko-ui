---
id: T247
title: "remove-deposit-state-module-and-add-changeset"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-09T06:55:31Z
updated_at: 2026-05-09T07:01:10Z
---

## Requirements

- Remove `packages/bridge-sdk/src/deposit-state.ts`.
- Keep shared deposit state/context helpers inside `packages/bridge-sdk/src/deposits.ts`.
- Keep deposit cancellation behavior in its own module, with `packages/bridge-sdk/src/cancellations.ts` importing the shared helpers it needs from `deposits.ts`.
- Preserve the public `Bridge` facade and the internal compatibility hook for deposit finalization witnesses.
- Add a changeset for the bridge-sdk refactor.
- Validate bridge-sdk and affected bridge CLI/UI tests before pushing the PR update.

## Test Plan

- Test Strategy Exception: this follow-up is structural and packaging metadata only; it intentionally does not add or change behavior. T197/T198 already added a focused prover regression test and ran bridge-sdk cancellation/finalization characterization tests after the cancellation split. For this task, correctness is validated by the existing characterization suite, TypeScript module-boundary checks, build output, and affected CLI/UI tests after removing `deposit-state.ts`.

## RED Evidence

- Exception recorded before source edits. No new behavior is expected; existing tests define the behavior to preserve.

## GREEN Evidence

- Removed `packages/bridge-sdk/src/deposit-state.ts`; shared deposit state/context helpers now live in `packages/bridge-sdk/src/deposits.ts`.
- Kept cancellation execution and availability behavior in `packages/bridge-sdk/src/cancellations.ts`, importing the shared deposit helpers from `deposits.ts`.
- Added `.changeset/curly-brooms-juggle.md` for `@zeko-labs/bridge-sdk`.
- `moon run bridge-sdk:test -f` passed: 6 files, 26 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:lint -f` passed with only the pre-existing `ExtractInput<any>` warnings in `packages/bridge-sdk/src/types.ts`.
- `moon run bridge-cli:test -f -- tests/direct-commands.test.ts tests/bridge-flow.test.ts` passed: 2 files, 31 passed, 13 skipped.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/transaction-machine.test.ts` passed: 2 files, 11 tests.
- `moon run bridge-ui:typecheck -f` passed.
