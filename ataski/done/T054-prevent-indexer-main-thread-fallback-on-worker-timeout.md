---
id: T054
title: "Prevent indexer main-thread fallback on worker timeout"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T15:35:07Z
updated_at: 2026-03-09T15:37:35Z
---

## Scope

Keep the actions-indexer responsive under heavy action-processing load by preventing worker timeouts from falling back to main-thread processing in the production fetch path.

## TDD Exception

This task is driven by live runtime saturation and responsiveness failures observed in the deployed indexer. Unit tests can cover the runtime mechanics, but the production failure mode itself is environment and load dependent.

Validation strategy:

1. Add or update runtime tests for the non-fallback behavior.
2. Validate build/tests locally.
3. Re-run live diagnostics and confirm the service remains responsive while worker processing stays off the main thread.

## GREEN Evidence

```bash
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:test-service-integration -f
```

Result:

- `typecheck`, `lint`, and `test-service-integration` passed.
- production fetch path now disables main-thread fallback for action processing.
- worker timeouts now retry with smaller worker chunks before surfacing an error.
- the indexer loop timing remains unchanged: it already waits after each run finishes.
