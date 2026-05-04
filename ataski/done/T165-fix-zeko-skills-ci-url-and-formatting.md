---
id: T165
title: "Fix zeko-skills CI URL and formatting"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-04T17:06:59Z
updated_at: 2026-05-04T17:13:15Z
---

## Requirements

- Change only the current `zeko-skills` CI workflow file URL that is causing the install-source problem.
- Run the relevant formatting command instead of hand-formatting files.
- Keep the diff minimal and avoid unrelated docs, tests, or workflow changes.

## Test Plan

- DDD: inspect the current workflow and package tasks, then validate the minimal change with the affected formatter/check commands after the edit.

## RED Evidence

- `.github/workflows/sync-zeko-skills.yaml` still pointed `ZEKO_SKILLS_PUBLIC_SOURCE` at the
  older full GitHub URL instead of the current source identifier the install flow expects.
- The repo formatter command could not run in this checkout until dependencies were refreshed,
  which is why `CI=true pnpm install --frozen-lockfile` was required before formatting.

## GREEN Evidence

- Updated `.github/workflows/sync-zeko-skills.yaml` so `validate-public-install` uses
  `ZEKO_SKILLS_PUBLIC_SOURCE: zeko-labs/zeko-skills`.
- Ran `pnpm exec dprint fmt .github/workflows/sync-zeko-skills.yaml`.
- Ran `env ZEKO_SKILLS_PUBLIC_SOURCE=zeko-labs/zeko-skills moon run -f
  zeko-skills:validate-public-install`.
- Restored commit-hook tooling with `pnpm exec lefthook install` and
  `pnpm exec lefthook validate`.
