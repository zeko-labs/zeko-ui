---
id: T142
title: "Merge main and resolve WEB-404 conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-24T14:21:07Z
updated_at: 2026-03-24T14:21:07Z
---

## Requirements

- Merge the current `main` branch into `branch/web-404-cancellation-queue` from the canonical Ataski worktree.
- Resolve every merge conflict without regressing the WEB-404 cancellation-lane behavior already implemented in bridge-ui.
- Keep the bridge-ui recovery flow serialized for normal operations while preserving the separate cancellation lane for cancellable deposits.
- Leave the board changes committed on the canonical feature branch.

## Test Plan

- TDD
- Re-run the bridge-ui automated checks after the merge and use any failing assertions or type errors as the RED signal for incorrect conflict resolution.

## RED Evidence

- PR `#159` is currently `DIRTY`, which means the branch cannot merge cleanly with `main`.

## GREEN Evidence

