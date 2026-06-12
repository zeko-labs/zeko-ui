---
id: T322
title: "use tsgo for typecheck tasks"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T22:44:06Z
updated_at: 2026-06-12T23:01:01Z
---

## Requirements

- Add `@typescript/native-preview` and use its `tsgo` binary wherever repository Moon tasks currently invoke `tsc` directly.
- Keep `typescript` available where libraries/tools still require it as a package dependency, but direct typecheck/build tasks should invoke `tsgo`.
- Update package/catalog metadata and lockfile consistently.
- Do not replace Nuxt `nuxi typecheck`, Vue `vue-tsc`, or build tools that merely consume TypeScript APIs internally.

## Test Plan

- TDD: add/update a repository tooling test that fails while Moon task commands still invoke bare `tsc`, then update commands and dependencies.

## RED Evidence

- `pnpm exec moon run sync-standalone-package:test -f -- --run tests/sync-standalone-package.integration.test.ts tests/repo-typecheck-tooling.test.ts` failed because repository Moon files still contain direct `command: tsc ...` entries and root metadata does not yet include `@typescript/native-preview`.

## GREEN Evidence

- `pnpm exec moon run sync-standalone-package:test -f -- --run tests/sync-standalone-package.integration.test.ts tests/repo-typecheck-tooling.test.ts` passed.
- `pnpm exec moon run -f networks:typecheck sync-standalone-package:typecheck faucet:typecheck bridge-cli:typecheck bridge-sdk:typecheck graphql:typecheck cloudflare-build-config:typecheck sdk:typecheck zeko-skills:typecheck zeko-skills:build actions-api:typecheck actions-indexer:typecheck bridge-validator:typecheck` passed.
- `rg "\btsc\b" -n --glob '!node_modules/**' --glob '!ataski/worktrees/**' --glob '!pnpm-lock.yaml' --glob '!**/dist/**'` now reports only historical Ataski notes, `vue-tsc` package names, and the tooling test assertion.
