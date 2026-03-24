---
id: T129
title: "Validate and resolve PR 144 review comments"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T11:34:00Z
updated_at: 2026-03-24T11:44:03Z
---

## Requirements

- Fetch all current review comments and unresolved review threads on PR #144.
- Validate each comment against the current branch head instead of assuming it still applies.
- Implement fixes only for comments that are still valid and beneficial.
- Resolve all review threads that are satisfied by the current code or by follow-up fixes in this task.
- Keep review handling explicit: note which comments were already obsolete versus which required code changes.

## Test Plan

- DDD. Inspect the live PR comments first, reproduce or validate each claim against the current code, then rerun the relevant package checks and resolve the threads that are satisfied.

## RED Evidence

- PR #144 still had unresolved live review threads on current code:
  - `packages/use-zeko/src/spec.ts`: `forbiddenMarkdownPatterns` used `/g`, which makes repeated `.test()` calls stateful.
  - `packages/use-zeko/src/utils.ts`: `endsWithPathSegment()` resolved both operands against CWD, which can miss absolute paths emitted by `opencode`.
- PR #144 also had unresolved outdated review threads against the deleted monolithic `packages/use-zeko/src/index.ts`; those needed validation before resolution instead of being resolved blindly.

## GREEN Evidence

- Removed `/g` from `forbiddenMarkdownPatterns` in `packages/use-zeko/src/spec.ts`.
- Fixed `normalizePath()` / `endsWithPathSegment()` in `packages/use-zeko/src/utils.ts` so repo-relative suffixes match absolute read paths correctly.
- Added regression coverage in `packages/use-zeko/tests/spec-and-utils.test.ts`.
- Validated the full package after the fix:
  - `moon run -f use-zeko:test`
  - `moon run -f use-zeko:check`
- Validated review status before resolution:
  - current `spec.ts` and `utils.ts` comments were real and are now fixed
  - outdated `index.ts` comments were stale because that file had already been split and the commented code no longer exists
