---
id: T145
title: "Rewrite public README and move maintainer docs"
status: done
blockedBy: [T144]
owner: codex
created_at: 2026-03-24T12:52:14Z
updated_at: 2026-03-24T13:15:00Z
---

## Requirements

- Rewrite the skill package `README.md` into a public-facing installation and usage document.
- Document how to install the skill with the public `skill.sh` CLI instead of monorepo-oriented commands.
- Move maintainer-only, monorepo-only, and testing details into a separate `TESTING.md`.
- Ensure `TESTING.md` does not sync into the public standalone repo while `README.md` does.

## Test Plan

- DDD. First inspect the current standalone export surface, then rewrite the docs and verify the mirrored output only exposes the intended public files.

## RED Evidence

- The first attempt to make `moon run -f zeko-skills:check` install the staged public surface with `npx skills add <local-path>` failed because the `skills` CLI does not discover a nested `zeko/SKILL.md` from a raw local directory shaped like the final public repo.
- That behavior was validated manually with `npx --yes skills add <temp-source> --agent codex --copy -y`, which reported `No valid skills found`.

## GREEN Evidence

- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:check`
- Public package docs are now split into `README.md` for external install/use and `TESTING.md` for monorepo-only validation and maintainer workflows.
