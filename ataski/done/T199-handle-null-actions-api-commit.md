---
id: T199
title: "Handle null Actions API commit responses"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-11T18:20:04Z
updated_at: 2026-05-11T18:31:04Z
---

## Requirements

- Update the bridge SDK so `commitAsePastSlot` responses with `commit: null` are treated as valid backend responses rather than invalid payloads.
- Deposit and withdrawal status/finalization APIs must surface a waiting/non-finalizable state when no outer commit is available yet.
- Preserve existing behavior when a commit is present.
- Keep the CLI compatible through the existing SDK adapter without adding CLI-specific handling for this backend response.

## Test Plan

- TDD: first add SDK tests that reproduce the current parser/runtime failure for `commit: null`, then update implementation until those tests pass.
- Validate with `moon run bridge-sdk:test -f` and `moon run bridge-sdk:typecheck -f`.

## RED Evidence

- `moon run bridge-sdk:test -f -- test/null-commit-state.test.ts` fails on the new null-commit coverage:
- Deposit status throws `Cannot read properties of null (reading 'index')`.
- Deposit finalization rejects instead of returning `{ available: false, reason: "No outer commit available yet" }`.
- Withdrawal status throws `Cannot read properties of null (reading 'innerActionStateLength')`.
- Withdrawal finalization rejects instead of returning waiting status.
- The same run also timed out in the existing live manual test because the task command includes `test/*.test.ts`; that is unrelated to the RED assertion.

## GREEN Evidence

- `pnpm exec vitest run test/deposit-cancellation.test.ts test/diagnostics.test.ts test/errors.test.ts test/withdrawal-finalization-state.test.ts test/withdrawal-state.test.ts test/null-commit-state.test.ts` passed: 6 files, 32 tests.
- `moon run bridge-sdk:test -f` passed: 7 files, 33 tests, including the existing live manual read-only test.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:test -f` passed: 16 files, 69 passed, 13 skipped.
