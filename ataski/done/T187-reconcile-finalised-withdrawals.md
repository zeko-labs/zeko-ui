---
id: T187
title: "Reconcile finalised withdrawals"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T18:23:40Z
updated_at: 2026-05-07T18:34:23Z
---

## Requirements

- Fix withdrawal finalization reconciliation so the SDK distinguishes an already-finalised withdrawal from an unavailable/not-ready withdrawal.
- Make page-load reconstruction classify withdrawals as finalised when helper account state proves the matching indexed withdrawal has already been consumed.
- Make the bridge UI transition a resumed pending withdrawal to completed when the SDK reports it is already finalised.
- Preserve chain/indexer timestamp semantics: do not write `Date.now()` into indexer-derived action state.
- Give live completed operations a UI-only completion timestamp fallback so just-completed rows do not display `Unknown`.
- Keep unrelated local changes in `.gitignore`, `apps/bridge-ui/machines/helpers.ts`, `packages/bridge-cli/src/core/sdk-config.ts`, and `services/actions/indexer/.env.alphanet` untouched.

## Test Plan

- TDD: add focused failing tests for the SDK withdrawal classification and UI pending-withdrawal reconciliation before implementation.
- Add a UI machine test that a pending withdrawal completes when `canFinalizeWithdrawal` returns an already-finalised status.
- Do not add a dedicated unit test for the local date display fallback; verify it through the bridge operation context behavior while keeping indexer-derived timestamps untouched.
- Run targeted bridge SDK and bridge UI tests, then typecheck the touched packages.

## RED Evidence

- `moon run bridge-sdk:test -- test/withdrawal-finalization-state.test.ts` fails because `canFinalizeWithdrawal` returns `{ available: false, reason: "No my withdrawal index found" }` instead of a structured `alreadyFinalised` status when helper state has consumed the matching withdrawal index.
- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "already finalised|local completion timestamp"` fails because `PENDING_WITHDRAWAL` keeps polling after `alreadyFinalised`, and completed live finalization has no `completedAtMs` context value.

## GREEN Evidence

- `moon run bridge-sdk:test -- test/withdrawal-finalization-state.test.ts` passes; includes already-finalised status from both commit-range actions and matching witnesses plus helper state.
- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "already finalised|local completion timestamp"` passes.
- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/bridge-view-model.test.ts test/unit/bridge-operations-table.test.ts` passes.
- `moon run bridge-sdk:typecheck` passes.
- `moon run bridge-ui:typecheck` passes.
- `moon run bridge-cli:typecheck` passes.
- `moon run bridge-ui:lint` passes.
- `moon run bridge-sdk:lint` passes with existing `ExtractInput` explicit-any warnings only.
