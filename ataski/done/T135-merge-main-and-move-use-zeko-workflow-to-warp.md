---
id: T135
title: "Merge main and move use-zeko workflow to Warp runners"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T12:09:05Z
updated_at: 2026-03-24T12:11:30Z
---

## Requirements

- Reproduce the current merge-conflict state for PR #144 against the latest `origin/main`.
- Merge `origin/main` into `branch/use-zeko-skill-public-mirror` and resolve every resulting conflict locally.
- Update `.github/workflows/use-zeko-skill.yaml` to use the repo-standard Warp runner instead of `ubuntu-latest`.
- Preserve the `use-zeko` package behavior and rerun the package verification after the merge and workflow update.

## Test Plan

- DDD. First reproduce the dirty merge state with a local merge against the latest `origin/main`, then resolve the conflicts, patch the workflow runner, and rerun the `use-zeko` package tests/checks from the repo root.

## RED Evidence

- `gh pr view 144 --json mergeStateStatus` returned `DIRTY`.
- `git merge origin/main` reproduced the conflict locally in `ataski/tasks.md`.
- The conflict came from another upstream Ataski ID reuse wave: `origin/main` had added unrelated `T116` and `T117` tasks while this branch still used those IDs for `use-zeko`.
- `.github/workflows/use-zeko-skill.yaml` was still on `ubuntu-latest` while the repo had otherwise moved release and CI workflows onto Warp runners.

## GREEN Evidence

- Kept upstream `T116` and `T117` and renumbered the colliding `use-zeko` tasks to `T136` and `T137`.
- Updated the dedicated skill workflow to `runs-on: warp-ubuntu-latest-x64-2x`.
- Re-ran the package verification from the repo root:
  - `moon run -f use-zeko:test`
  - `moon run -f use-zeko:check`
