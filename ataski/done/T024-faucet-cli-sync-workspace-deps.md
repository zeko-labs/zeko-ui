---
id: T024
title: "Make faucet-cli sync workspace deps publish-safe"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-02T12:49:17Z
updated_at: 2026-03-02T12:50:34Z
---

TDD Exception

This change updates CI workflow manifest-rewrite behavior. A red test is not practical here because the behavior runs inside GitHub Actions, so validation will use targeted local script execution and workflow diff inspection before and after the change.

GREEN Evidence

- `pnpm install --frozen-lockfile` passes from the monorepo root after the lockfile update.
- A local Node validation of the sync rewrite logic resolves all six `workspace:*` optional dependencies in `packages/faucet-cli/package.json` to `0.1.0` before publish/split.
