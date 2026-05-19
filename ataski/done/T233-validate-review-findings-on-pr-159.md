---
id: T233
title: "Validate review findings on PR-159"
status: done
blockedBy: [T167]
owner: codex
created_at: 2026-03-30T17:35:11Z
updated_at: 2026-03-30T17:47:56Z
---

## Requirements

- Read the current review comments and review summaries on PR `#159`.
- Validate each finding against the post-merge branch state instead of assuming it still applies.
- Fix any still-valid findings in the bridge-ui branch cleanly and add or update tests where that is the right proof.
- Record which comments were no longer applicable after the merge and cleanup.

## Test Plan

- TDD
- Reproduce any valid finding with a focused test or direct code-path inspection before changing code, then rerun the relevant bridge-ui checks after the fix.

## RED Evidence

- PR comments on `apps/bridge-ui/machines/bridge.ts` remained valid after the merge: `completeOperation` only released `activeCancellationOperation` for `lane === "cancellation"`, leaving a completed main-lane cancellation able to hold the slot indefinitely.
- The PR comment on duplicate `Cancel` events in `apps/bridge-ui/machines/bridgeOperation.ts` did not reproduce as a bug after inspection; the state change to `CANCEL_DEPOSIT` causes subsequent `Cancel` events to be ignored.

## GREEN Evidence

- Fixed the valid cancellation-slot leak by clearing `activeCancellationOperation` whenever the completing operation owns the slot, regardless of lane.
- Added `apps/bridge-ui/test/unit/bridge.test.ts` to lock the main-lane cancellation completion path.
- Added a duplicate-cancel regression in `apps/bridge-ui/test/unit/bridge-operation.test.ts`.
- Added timestamp-backed queue metadata coverage in `apps/bridge-ui/test/unit/helpers-queue.test.ts`.
- `pnpm exec vitest run test/unit/bridge.test.ts test/unit/bridge-operation.test.ts test/unit/helpers-queue.test.ts`
