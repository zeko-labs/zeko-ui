---
id: T194
title: "Merge new main tip into WEB-404"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-08T21:23:57Z
updated_at: 2026-05-08T21:23:57Z
---

## Requirements

- Merge the latest `origin/main` tip `c51b7d8` into `branch/web-404-cancellation-queue` after the first merge completed against `39948b6`.
- Preserve WEB-404 cancellation queue behavior and the bridge UI validation fixes from T193.
- Validate the bridge UI and push the updated PR branch.

## Test Plan

- DDD
- Use `moon run bridge-ui:typecheck -f` and `moon run bridge-ui:test -f` as the merge validation gate.

## RED Evidence

## GREEN Evidence
