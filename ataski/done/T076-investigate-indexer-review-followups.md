---
id: T076
title: "Investigate and fix indexer review followups"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:27:35Z
updated_at: 2026-03-11T17:31:42Z
---

## Requirements

- Validate the current PR review findings that affect the actions indexer and its diagnostics/CLI compatibility, including the additional findings provided in the thread.
- Implement fixes only for findings that are real issues in the current branch. Do not make speculative cleanups for informational-only comments.
- At minimum, evaluate the `/health` CLI schema compatibility finding and the shallow-clone/canonical-progress monitor findings, and confirm whether any other indexer findings require action.
- Preserve the intended WEB-395 behavior for canonical progression and partial stream failure handling.

## Test Plan

- DDD
- Add or update focused tests for any validated indexer fixes, especially around CLI schema compatibility and monitor snapshot immutability if those issues are confirmed.
- Re-run the targeted indexer Vitest coverage plus `moon run actions-indexer:typecheck -f`.
- Record only the GREEN evidence for the issues that actually resulted in code changes.

## RED Evidence

## Test Strategy Exception

The review followups are a mixed investigation across multiple claims, and most do not map cleanly to pre-existing failing assertions before the code is inspected. This task will validate each claim against the current branch first, then add or run focused coverage for the subset that requires an actual code change.

## GREEN Evidence

- Validated and fixed:
  - `services/actions/indexer/src/cli/checks.ts`: made `HealthResponseSchema.indexer.canonicalProgress` optional so `runSyncCheck` still works against older `/health` payloads.
  - `services/actions/indexer/src/health.ts`: made canonical-progress snapshots and health responses return defensive copies instead of nested monitor references.
  - `services/actions/indexer/src/db.ts`: corrected the `COUNT(*)` annotation to match the actual driver return type before conversion.
- Investigated but intentionally did not change:
  - Single-stream failures remaining invisible to `consecutiveErrors` in health is real but intentional for the current partial-failure design.
  - The cached `baseDelay` behavior is pre-existing and negligible.
  - Promoting all fetched canonical rows is idempotent and only a minor performance note.
- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.checks.test.ts test/health.monitor.test.ts`
  - Passed: 2 files, 8 tests.
- `moon run actions-indexer:typecheck -f`
  - Passed.
