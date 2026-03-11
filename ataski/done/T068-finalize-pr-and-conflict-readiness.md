---
id: T068
title: "Finalize PR and conflict readiness"
status: done
blockedBy: [T066, T067]
owner: codex
created_at: 2026-03-11T10:21:57Z
updated_at: 2026-03-11T10:35:04Z
---

## Requirements

- Sync this branch with the latest `origin/main` before PR creation.
- Resolve any resulting conflicts in Ataski files, vendored skill files, and `AGENTS.md`.
- Re-run the repo-side verification after conflict resolution.
- Commit the branch with conventional commit messages and create a PR that is ready to merge after review.

## Test Plan

- Verify the branch is clean except for the intended tracked changes before push.
- Confirm the branch is up to date with `origin/main` at PR creation time.
- Ensure the PR opens against `main` without conflict warnings.

## RED Evidence

## GREEN Evidence

- Installed and validated Lefthook in the worktree after the initial ungated commit attempt reported `Can't find lefthook in PATH`.
- Added `.agents/skills/ataski/**` to `dprint.json` excludes so the vendored Ataski skill files remain byte-aligned with upstream and no longer break `dprint fmt`.
- Recreated the commit with a real Lefthook pre-commit run:
  - `pnpm exec moon run :lint-fix` passed with existing non-blocking warnings in unrelated `bridge-sdk`, `lb-api`, and `lb-indexer` files.
  - `pnpm exec moon run :format-all-fix` passed after the `dprint` exclusion fix.
- Rebased the branch onto `origin/main`, resolved the `ataski/tasks.md` conflict by preserving `origin/main` task `T064` and this branch's `T065` through `T068`, then completed the rebase successfully.
- Final readiness checks:
  - `git status --short` returned clean.
  - `git rev-list --left-right --count HEAD...origin/main` returned `1 0`.
