---
id: T222
title: "Resolve WEB-404 main conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-14T15:14:24Z
updated_at: 2026-05-14T15:14:24Z
---

## Requirements

- Merge the latest `origin/main` into `branch/web-404-cancellation-queue`.
- Resolve conflicts while preserving the WEB-404 cancellation queue UX and the simplified parent-machine queue state.
- Keep WEB-404 Ataski task records after the latest main tasks instead of colliding with main task IDs.
- Validate with bridge UI typecheck and tests.
- Commit and push the branch for review.

## Test Plan

- DDD
- Use the merge result plus existing bridge UI queue, recovery, and operation tests as the validation gate.
- Run `moon run bridge-ui:typecheck -f` and `moon run bridge-ui:test -f`.

## RED Evidence

## GREEN Evidence
