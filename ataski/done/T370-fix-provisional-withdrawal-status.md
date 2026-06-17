---
id: T370
title: "Fix provisional withdrawal status"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:09:00Z
updated_at: 2026-06-17T07:11:00Z
---

## Requirements

- Address the remaining Codex review finding on PR #215.
- Provisional withdrawals without a matched final inner witness must not use wallet-local action indexes to compute `committed` or `finalised`.
- Keep provisional withdrawals visible in queue state after finality filtering with `committed: false` and `finalised: false`.
- Preserve witnessed withdrawal behavior, where a matched final inner witness provides the global inner index needed to compute committed/finalised state.
- Preserve existing bridge version display for queued wallet actions.

## Test Plan

- TDD.
- RED: update the existing unwitnessed-withdrawal test so a helper account advanced past global index 0 does not mark a locally indexed provisional withdrawal committed/finalised without a matched final witness.
- GREEN: update the provisional mapping in `fetchWithdrawalsWithStates`, then rerun focused SDK tests, typechecks, and Codex review.

## RED Evidence

- `codex-review --mode branch` reported `[P2] Don't use wallet-local indexes for provisional status`: the provisional path used `withdrawal.index` from the user's wallet action stream with global helper/commit indexes, which can mark fresh pending withdrawals committed/finalised before any final inner witness exists.

## GREEN Evidence

- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
- `moon run actions-api:manual-db-test -f` remains blocked before assertions because Docker/OrbStack is not running.
