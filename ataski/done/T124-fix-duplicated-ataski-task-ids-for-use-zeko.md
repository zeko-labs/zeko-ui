---
id: T124
title: "Fix duplicated Ataski task IDs for use-zeko"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:42:39Z
updated_at: 2026-03-24T01:44:03Z
---

## Requirements

- Fix the reused Ataski task IDs for the original `use-zeko` work items currently stored as `T068` through `T076`.
- Allocate fresh IDs after the current highest allocated task ID, preserving the original indexer task IDs and tracker entries.
- Rename the affected task files, update their frontmatter IDs, update any `blockedBy` references among those skill tasks, and add matching `tasks.md` entries.
- Leave unrelated task content untouched.

## Test Plan

- DDD. Inventory the duplicate files and tracker mismatch, then renumber the affected skill tasks and rerun targeted searches to confirm there are no duplicate `T068`–`T076` files left and every renamed task has a tracker entry.

## RED Evidence

- duplicate task files existed for `T068` through `T076`, with both the original indexer tasks and the later `use-zeko` tasks present under `ataski/done/`
- `tasks.md` only tracked the original `T068` through `T076` entries, leaving the `use-zeko` task files untracked
- `rg -n '\\bT0(68|69|70|71|72|73|74|75|76)\\b' ...` across the affected skill task files showed reused IDs plus stale `blockedBy: [T068]` references

## GREEN Evidence

- only the original indexer `T068` through `T076` files remain under those IDs
- `tasks.md` now includes `T134`, `T136`, `T137`, and `T118` through `T123` for the renamed `use-zeko` tasks
- targeted ripgrep over the renamed files found no stale `id: T068`–`T076` or `blockedBy: [T068]` content
