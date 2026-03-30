---
id: T144
title: "Rename use-zeko package and sync to zeko-skills"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T12:52:14Z
updated_at: 2026-03-24T13:08:00Z
---

## Requirements

- Rename the published skill package and related monorepo identifiers from `use-zeko` to `zeko-skills`.
- Update the sync workflow and standalone export configuration so the new public mirror repo is `zeko-skills`.
- Prepare the standalone/mirrored output so the public repo only contains the public `README.md` and the `zeko/` skill directory.
- Keep the monorepo package functional after the rename, including Moon project wiring, validation tasks, and mirror tests.

## Test Plan

- DDD. First inventory every `use-zeko` package/sync/workflow reference, then rename and rerun the package tests plus mirror-shape checks from the repo root.

## RED Evidence

- `moon run -f zeko-skills:test` initially failed with `vitest: command not found` before installing workspace dependencies in this worktree.
- `moon run -f zeko-skills:typecheck` initially failed with `tsc: command not found` for the same reason.

## GREEN Evidence

- `pnpm install`
- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:typecheck`
- `rg -n "\\buse-zeko\\b|sync-use-zeko|@zeko/use-zeko|packages/use-zeko|use-zeko:" . --glob '!ataski/**' --glob '!packages/zeko-skills/README.md'` returned no matches
