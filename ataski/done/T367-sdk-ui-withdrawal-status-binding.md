---
id: T367
title: "SDK UI withdrawal status binding"
status: done
blockedBy: [T366]
owner: codex
created_at: 2026-06-17T05:40:00Z
updated_at: 2026-06-17T07:35:00Z
---

## Requirements

- Prevent repeated same-recipient/same-amount withdrawals from being collapsed or completed only because they share `withdrawalAux`.
- In the bridge SDK, keep using aux to fetch candidate witnesses, but bind fetched witnesses back to user withdrawal actions by exact action identity such as `afterActionState`/index, not aux alone.
- Preserve unresolved/provisional withdrawal actions in queue state when no exact witness exists yet, even if another action with the same aux has a witness.
- Ensure the bridge UI no longer receives a false `finalised: true` status for a newer same-aux withdrawal after refresh.
- Add or adjust tests that reproduce the current false-completed condition before implementation.

## Test Plan

- TDD.
- RED: add a bridge SDK regression test with two same-aux withdrawals where only the older action has a witness/finalized helper state, and assert the newer exact action remains present and not finalised.
- GREEN: update SDK witness matching and, if necessary, UI recovery tests so only exact action matches can complete a withdrawal.

## RED Evidence

- `moon run bridge-sdk:test -f` failed after adding the same-aux regression tests:
  - `withdrawal state > does not collapse repeated same-aux withdrawals onto an older witness` returned only the older witnessed row instead of preserving the newer withdrawal.
  - `withdrawal finalization state > does not report already-finalised from an older same-aux witness while a newer action is unresolved` returned the wrong waiting reason because finalization still fetched amount/recipient-only withdrawals instead of exact action identities.
- A first attempt with `--runInBand` was rejected by Vitest as an unsupported option before tests ran.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 14 files, 59 tests.
- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
- Pre-commit Lefthook passed for commit `2cd3bd17` with `MOON_NO_ACTIONS=true`: `:lint-fix`, `:format-all-fix`, and `bridge-ui:typecheck` all ran. The hook formatted one file and reported existing lint warnings in unrelated files but no blocking errors.
