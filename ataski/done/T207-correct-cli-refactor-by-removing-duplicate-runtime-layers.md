---
id: T207
title: "Correct CLI refactor by removing duplicate runtime layers"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T23:36:40Z
updated_at: 2026-05-12T23:40:43Z
---

## Requirements

- Fix the prior refactor by removing CLI-only abstraction layers that duplicated, rather than replaced, existing runtime concepts.
- Do not modify `packages/bridge-sdk`.
- Keep public CLI behavior, persisted session shape, JSON output, verbose diagnostics, retry behavior, and package boundary unchanged.
- Prefer deleting redundant concepts over extracting more files.
- Keep tests focused on observable behavior and remaining service boundaries.

## Test Plan

- DDD.
- Inspect the current runner and remove duplicated orchestration layers while preserving existing behavior tests.
- Validate with:
  - `moon run bridge-cli:test -f`
  - `moon run bridge-cli:typecheck -f`
  - `moon run bridge-cli:lint -f`
  - `moon run bridge-cli:build -f`

## RED Evidence

- User review identified that T203-T206 spread complexity into extra files and kept redundant CLI orchestration instead of removing it.

## GREEN Evidence

- Removed the bridge command's separate xstate runner and replaced it with one explicit operation loop over existing step results.
- Corrected finalize/cancel step return values that had previously depended on the xstate runner ignoring their `next` field.
- `moon run bridge-cli:test -f` passed.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-cli:build -f` passed.
- Confirmed no `packages/bridge-sdk` diff.
