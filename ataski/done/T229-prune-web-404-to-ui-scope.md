---
id: T229
title: "Prune WEB-404 to UI scope"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T16:02:00Z
updated_at: 2026-03-30T16:07:51Z
---

## Requirements

- Remove from `branch/web-404-cancellation-queue` all non-UI diffs that belong in the separate bugfix PR, including bridge-sdk, bridge-cli, changeset, and temporary probe artifacts.
- Clean the WEB-404 Ataski board so non-UI tasks do not remain in this branch diff once the scope cleanup is complete.
- Keep the bridge-ui queue UX work, WEB-404-specific board history, and bridge-ui README updates intact.
- Do not introduce new bridge-sdk or bridge-cli behavior changes while pruning the branch.

## Test Plan

- DDD
- Inspect the branch diff before and after pruning, then rerun the bridge-ui automated checks after the branch contains only the intended UI scope.

## RED Evidence

- `git diff --name-status main...HEAD` still includes bridge-sdk, bridge-cli, `.changeset/slow-bears-bow.md`, and `packages/bridge-sdk/tmp-bridge-probe.mjs`.
- The WEB-404 board still contains non-UI task files (`T152`, `T154`, `T155`) even though those fixes were consolidated into `branch/t165-bridge-cli-sdk-resume-fix`.

## GREEN Evidence

- Restored the bridge-sdk, bridge-cli, changeset, and temporary probe paths back to `main` in the WEB-404 worktree.
- Removed the corresponding WEB-404 board files and tracker entries for `T148`, `T149`, `T152`, `T154`, and `T155`.
- `git diff --name-status main --` for the extracted non-UI paths is now empty.
