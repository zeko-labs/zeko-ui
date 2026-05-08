---
id: T170
title: "Merge latest main into WEB-404"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-08T20:56:50Z
updated_at: 2026-05-08T20:56:50Z
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

## GREEN Evidence
