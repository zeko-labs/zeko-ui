---
id: T146
title: "Add docs site section for zeko-skills"
status: done
blockedBy: [T144, T145]
owner: codex
created_at: 2026-03-24T12:52:14Z
updated_at: 2026-03-24T14:00:00Z
---

## Requirements

- Add a docs-site section that surfaces the public Zeko skill and points readers to the public installation flow.
- Use the final `zeko-skills` naming and public install commands produced by the rename/readme work.
- Keep the docs copy public-facing and avoid maintainer/monorepo internals.
- Assumption for this task: the requested docs section should reference the public `zeko-skills` repo and `skill.sh` installation flow unless the user clarifies otherwise.

## Test Plan

- DDD. First inspect the docs navigation/content structure, then add the new section/page and verify the relevant docs config/content references are wired correctly.

## RED Evidence

- The first public-install validation attempts proved that a public repo shaped as `README.md + zeko/` does not satisfy the `skills` CLI install path the user requested.
- Direct GitHub pushes are currently blocked in this shell with `Could not resolve host: github.com`, so the final manual sync/PR publication step cannot be completed from this environment.

## GREEN Evidence

- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:check`
- `moon run docs:build`
- Added the public docs page at `apps/docs/content/developers/tools/agent-skills.md` and linked it from the Developer Tools sidebar.
