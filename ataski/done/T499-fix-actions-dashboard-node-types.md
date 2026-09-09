---
id: T499
title: "Fix Actions Dashboard Node typecheck"
status: done
blockedBy: []
owner: codex
created_at: 2026-09-09T09:35:00Z
updated_at: 2026-09-09T09:55:00Z
---
## Requirements

- Make `apps/actions-dashboard:typecheck` resolve the Node built-in imports used by `apps/actions-dashboard/nuxt.config.ts`.
- Add only the required development type dependency using the repository catalog/version convention.
- Update the lockfile through the supported package-manager command; do not hand-edit dependency resolution data.
- Preserve the Sepolia-only dashboard behavior and unrelated working-tree changes.

## Test Plan

- Strategy: TDD.
- RED: the existing `node_modules/.bin/moon run actions-dashboard:typecheck -f` failure reports missing `node:path` and `node:url` declarations.
- GREEN: install the declared Node types and rerun dashboard typecheck, tests, lint, and build/deploy dry-run validation.

## RED Evidence

- `node_modules/.bin/moon run actions-dashboard:typecheck -f` failed with TS2307 for `node:path` and `node:url` in `apps/actions-dashboard/nuxt.config.ts`.

## GREEN Evidence

- `nix develop -c bash -lc 'pnpm install --lockfile-only'` updated `pnpm-lock.yaml` for the direct `@types/node` development dependency.
- `nix develop -c bash -lc 'pnpm install --offline'` completed and linked the dependency.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:typecheck -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:test -f'` passed: 39 tests.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:lint -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:build -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:deploy -f'` passed; Worker version `372bd432-4f13-499f-8093-bf680d4dce72` deployed to `actions.dashboard.zeko.io`.
