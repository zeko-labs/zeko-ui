---
id: T270
title: "Resolve main conflicts for PR183"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T05:18:19Z
updated_at: 2026-05-27T05:40:18Z
---

## Requirements

- Merge current `origin/main` into `branch/bridge-mainnet-readiness-plan`.
- Resolve conflicts without dropping mainnet-readiness behavior or unrelated `main` changes.
- Keep testnet/mainnet deploy separation intact.
- Commit and push the conflict resolution branch.

## Test Plan

- DDD: this task is driven by GitHub reporting PR #183 as `DIRTY`.
- RED path: `gh pr view 183` reported `mergeStateStatus: DIRTY`.
- GREEN path: merge `origin/main`, resolve conflicts, run formatting and targeted validation for changed deploy/runtime surfaces, then confirm GitHub no longer reports the PR as dirty.

## RED Evidence

- GitHub PR metadata reported `mergeStateStatus: DIRTY` for PR #183.

## GREEN Evidence

- `moon run bridge-cli:test -f`: passed 22 files, 110 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck bridge-cli:build -f`: completed both tasks successfully.
- `moon run bridge-mainnet-readiness-plan:format-all -f`: completed successfully.
