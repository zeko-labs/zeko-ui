---
id: T138
title: "Validate remaining Devin review comments"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T12:15:00Z
updated_at: 2026-03-24T12:27:13Z
---

## Requirements

- Inspect the remaining unresolved Devin review comments on PR #144.
- Validate each comment against the current code instead of assuming it is correct.
- Implement the fixes that are still real.
- Add regression coverage where it helps prevent the same issue or false positive from recurring.
- Resolve the satisfied Devin review threads on GitHub after the branch is updated.

## Test Plan

- DDD. Reproduce each comment against the current code first, patch only the real issue, rerun the targeted `use-zeko` verification, and then resolve the corresponding review threads.

## RED Evidence

- PR #144 still had two unresolved Devin threads:
  - `packages/use-zeko/tsconfig.json`: base config only included `tests`, so `moon run use-zeko:typecheck` skipped most of `src/`
  - `packages/use-zeko/src/validation/external-links.ts`: claimed the URL regex captured trailing markdown backticks
- Inspection confirmed the `tsconfig` comment was real.
- Reproducing the regex locally showed the current delimiter already excludes backticks, so that thread needed validation and proof rather than a blind code change.

## GREEN Evidence

- Fixed the real typecheck scope gap by changing `packages/use-zeko/tsconfig.json` to include both `src` and `tests`.
- Added regression coverage for the validated false positive in `packages/use-zeko/tests/external-links.test.ts`.
- Also tightened `packages/use-zeko/tests/validation-tooling.test.ts` to assert the base tsconfig includes `src` and `tests`.
- Verification:
  - `moon run -f use-zeko:test`
  - `moon run -f use-zeko:typecheck`
  - `moon run -f use-zeko:check`
