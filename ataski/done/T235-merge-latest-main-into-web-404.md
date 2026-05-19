---
id: T235
title: "Merge latest main into WEB-404"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T20:56:50Z
updated_at: 2026-05-08T21:22:01Z
---

## Requirements

- Merge the latest `origin/main` into `branch/web-404-cancellation-queue`.
- Resolve conflicts while preserving the WEB-404 cancellation queue behavior and any newer main-branch bridge-ui changes.
- Keep unrelated root checkout changes untouched.
- Validate the bridge UI after the merge.
- Commit and push the updated PR branch.

## Test Plan

- DDD
- Use the merge result plus `moon run bridge-ui:test` and `moon run bridge-ui:typecheck` as the validation gate.

## RED Evidence

- `git merge origin/main` produced conflicts in bridge UI cancellation/queue files, the bridge operation machine/test coverage, and Ataski tracker files.
- Initial `moon run bridge-ui:typecheck -f` failed because `CancellableOperation.vue` still matched the removed `CANCEL_DEPOSIT.send_and_confirm` child state after main introduced the transaction machine shape.

## GREEN Evidence

- Resolved the merge conflicts while preserving the WEB-404 separate cancellable deposit queue and main-branch transaction/completion handling.
- Updated cancellable deposit copy to match the merged `CANCEL_DEPOSIT.transaction -> done` state shape.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed: 17 files, 94 tests.
