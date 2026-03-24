---
id: T112
title: "Merge main and add bridge CLI skill guidance"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-24T00:56:13Z
updated_at: 2026-03-24T00:56:13Z
---

## Requirements

- Merge the latest `origin/main` into `branch/use-zeko-skill-public-mirror` in the canonical feature worktree.
- Integrate the new public Zeko bridge CLI into the installed `use-zeko` skill under `packages/use-zeko/zeko/`.
- Keep the skill progressive-discovery-first: route from `SKILL.md` into the smallest relevant reference file instead of sending agents to broad dumps.
- Prefer public docs pages and installed-skill-local guidance over repo-internal paths in shipped skill content.
- Include agent-useful bridge CLI guidance based on the new public docs page and canonical package behavior, including concrete command examples where they materially help an agent act.
- Update validation so the bridge CLI guidance stays present and discoverable.

## Test Plan

- TDD. First tighten the skill tests so they fail until bridge CLI guidance is present and routed correctly. Then update the skill references and rerun `moon run use-zeko:test` plus `moon run use-zeko:check`.

## RED Evidence

## GREEN Evidence
