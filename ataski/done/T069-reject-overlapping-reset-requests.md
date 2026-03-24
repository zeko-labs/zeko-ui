---
id: T069
title: "Reject overlapping reset requests"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T11:20:00Z
updated_at: 2026-03-11T11:28:47Z
---

## Scope

Replace the generic control queue with a simpler reset-specific in-progress guard so overlapping reset requests do not serialize; the second request should fail immediately with `A reset is already in progress`.

## RED

- `moon run actions-indexer:test-service-integration -f`
  - Failed in `test/service.integration.test.ts > rejects overlapping reset requests with a clear in-progress error`.
  - The current implementation still returns `200/200` because it serializes both resets instead of rejecting the second one.

## GREEN

- `moon run actions-indexer:test-service-integration -f`
  - Passed. One reset now returns `200`, and the overlapping reset returns `409` with `A reset is already in progress`.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
