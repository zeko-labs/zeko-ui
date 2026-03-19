---
id: T102
title: "Make operation status network-backed"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T16:10:00Z
updated_at: 2026-03-19T18:23:00Z
---

## Requirements

- Make `bridge-cli operation status` perform real SDK/network reads instead of only replaying persisted local state.
- Preserve the persisted session model while enriching it with a current live observation that explains what the command just saw.
- Update the docs so operators and future agents understand that `operation status` is a live refresh command, while `operation list` remains local state.
- Cover the new behavior with targeted tests.

## Test Plan

- DDD.
- RED path:
  - inspect the current `operation status` implementation
  - confirm it only loads from the session store and emits stale local JSON without creating an adapter or querying bridge state
- GREEN path:
  - add targeted tests proving `operation status` creates an adapter, calls status/capability SDK methods, persists the refreshed session, and reports actionable live progress
  - rerun `moon run bridge-cli:test -- --runInBand`

## RED Evidence

- `packages/bridge-cli/src/commands/operation.ts` currently implements `operation status` as `store.load(id)` plus `JSON.stringify(...)`.
- The command does not initialize a bridge adapter, does not call `getDepositStatuses`/`getWithdrawalStatuses`, and does not query capability methods.
- That means an interrupted one-command bridge run can leave `operation status` reporting stale local metadata while no process is actively checking the network.

## GREEN Evidence

- Updated `packages/bridge-cli/src/commands/operation.ts` so `operation status` now:
  - loads the persisted session
  - creates the route adapter
  - performs fresh `getDepositStatuses` / `getWithdrawalStatuses` reads plus capability checks
  - derives the current live phase/actionability from observed chain state
  - persists the refreshed session before printing it
- Added `liveSnapshot` to the operation session model so the status command records what it just observed, including `nextAction`, wait reason, target/claim indexes, capability booleans, and observed queue counts.
- Added targeted regression coverage in `packages/bridge-cli/tests/operation-command.test.ts` for:
  - refreshing a failed local session back into a live actionable running state
  - recognizing a terminal withdrawal from fresh network state and marking the session completed
- Re-ran `pnpm --dir packages/bridge-cli exec vitest run tests/operation-command.test.ts --config vitest.config.ts`: passed, 11 tests.
- Re-ran `moon run bridge-cli:test`: passed, 17 files / 80 tests.
