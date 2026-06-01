---
id: T281
title: "Align native typecheck followup"
status: done
blockedBy: [T280]
owner: codex
created_at: 2026-05-26T09:40:00Z
updated_at: 2026-05-26T10:35:00Z
---

## Requirements

- Move `vue-tsc` to the shared pnpm catalog and use the catalog from Nuxt app manifests.
- Remove the committed Nuxt readiness markdown document from the PR.
- Update the TypeScript catalog to the latest stable npm TypeScript release.
- Add and validate TypeScript native checking through `@typescript/native-preview` / `tsgo` for repository typecheck tasks where the native compiler can preserve existing coverage.
- Explicitly test whether Nuxt's `nuxt typecheck` / `nuxi typecheck` path is compatible with TypeScript native checking rather than assuming replacement behavior.
- Keep Nuxt/Vue SFC typechecking coverage intact; do not replace Nuxt typecheck with a command that skips `.vue` SFC/template checking.

## Test Plan

- DDD: verify current tool versions and native compiler behavior first, then update manifests/Moon tasks and validate both native TypeScript tasks and Nuxt typecheck tasks.

## RED Evidence

- npm reports latest `typescript` as `6.0.3`, while the PR currently keeps the catalog on `^5.9.3`.
- npm reports latest `@typescript/native-preview` as `7.0.0-dev.20260526.1`, and the PR does not include it yet.
- `vue-tsc` is pinned directly in active Nuxt app manifests instead of being cataloged.
- `docs/NUXT_4_4_READINESS.md` is currently committed in the PR but should not be.
- Nuxt's documented typecheck command runs `vue-tsc`; compatibility with TypeScript native checking must be tested in this branch.

## GREEN Evidence

- Catalog versions now use latest npm metadata checked on 2026-05-26: `typescript@^6.0.3`, `@typescript/native-preview@7.0.0-dev.20260526.1`, and `vue-tsc@^3.3.2`.
- Active Nuxt app manifests now consume `vue-tsc` through the shared pnpm catalog.
- Removed `docs/NUXT_4_4_READINESS.md`; the readiness investigation no longer lands as a committed doc.
- Plain TypeScript Moon `typecheck` tasks now run `tsgo` through `@typescript/native-preview`, with config portability updates for TS native where required.
- `pnpm --dir apps/bridge-ui exec nuxt typecheck --help` confirms Nuxt typecheck still runs `vue-tsc` and exposes no native/`tsgo` switch.
- Direct native checks against generated Nuxt configs are not equivalent to Nuxt typecheck: `apps/bridge-ui` passes with `tsgo -p .nuxt/tsconfig.json --noEmit`, while `apps/faucet-ui` fails on Nuxt/Nitro Cloudflare env binding types that `nuxi typecheck` handles.
- `moon run -f faucet:typecheck actions-indexer:typecheck cloudflare-build-config:typecheck sync-standalone-package:typecheck bridge-cli:typecheck zeko-skills:typecheck graphql:typecheck bridge-sdk:typecheck` passes with native TypeScript.
- `moon run -f bridge-ui:typecheck faucet-ui:typecheck` passes with Nuxt's `vue-tsc`-based checker on the TypeScript 6 catalog.
