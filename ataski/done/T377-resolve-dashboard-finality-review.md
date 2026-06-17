---
id: T377
title: "Resolve dashboard finality review"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T11:44:45Z
updated_at: 2026-06-17T11:46:54Z
---

## Requirements

- Treat L2 action finality as stalled when the DB has indexed pending action rows, none have ever been marked final, and the L2 archive canonical block height has already reached the last indexed action block.
- Keep the existing L2 finality-stall error behavior for rows with a non-null final action block height.
- Label the L2 archive finality gap as a block gap, not a transaction count.

## Test Plan

- TDD: first add a failing dashboard utility test for the null `finalActionBlockHeight` L2 stall case, then update the dashboard logic until the focused test passes.
- Validate the display-copy change with the existing dashboard test suite, since `finalityGapLabel` is page-local UI formatting.

## RED Evidence

- `moon run actions-dashboard:test -f` failed as expected after adding `reports L2 action finality stalls before any DB action is finalized`: `expected 'warn' to be 'error'` at `apps/actions-dashboard/test/ops.test.ts:979`.

## GREEN Evidence

- `moon run actions-dashboard:test -f` passed: 31 tests.
- `moon run actions-dashboard:typecheck -f` passed.
- `moon run actions-dashboard:lint -f` passed.
