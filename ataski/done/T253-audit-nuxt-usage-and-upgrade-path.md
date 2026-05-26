---
id: T253
title: "Audit Nuxt usage and upgrade path"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-26T08:07:17Z
updated_at: 2026-05-26T08:31:00Z
---

## Requirements

- Inventory every Nuxt app/layer in the monorepo, including Nuxt-related package versions, modules, config options, Moon tasks, generated typecheck flow, and current Vite/Rolldown setup.
- Review official Nuxt release notes from the repo's current `4.1.1` baseline through the latest 4.4.x release, including 4.2, 4.3, and 4.4 feature releases, and identify which new features are applicable to this codebase.
- Explicitly evaluate 4.4 features such as custom `createUseFetch`/`createUseAsyncData`, typed layout props, `useAnnouncer`, `payloadExtraction: 'client'`, view transitions, route generation changes, and build profiling.
- Review official TypeScript 7 native compiler guidance and determine whether Nuxt typecheck can use `tsgo` directly today, or whether this repo should add a separate trial task while keeping `nuxi typecheck` on supported Vue/Nuxt tooling.
- Review official Vite/Rolldown guidance and compare it to the repo's existing `pnpm.overrides.vite` setup.
- Record concrete upgrade decisions and validation targets for the implementation tasks.

## Test Plan

- DDD: this is an investigation task. Capture baseline commands and static analysis evidence before implementation, then use those findings to drive dependency/config changes.

## RED Evidence

- Investigation baseline started before dependency/config/source edits. Current shared Nuxt catalog version is `4.1.1`; current pnpm override aliases `vite` to `npm:rolldown-vite@7.1.9`; local `main` was behind `origin/main`, so the feature worktree was created from `origin/main` at `b51065f`.

## GREEN Evidence

- Nuxt inventory:
  - Active Nuxt apps are `apps/bridge-ui`, `apps/faucet-ui`, and `apps/leaderboard-ui`; shared Nuxt layer is `packages/layer`; `unused/ui` is not active but still in the workspace.
  - All active Nuxt apps use `extends: ["@zeko/layer"]`; active app route rules are SPA/static/prerender (`ssr: false`) rather than ISR/SWR SSR routes.
  - Nuxt typecheck is `nuxt typecheck` or `nuxi typecheck`; generated Nuxt tsconfigs are already project-reference style in bridge/leaderboard, while faucet still extends `.nuxt/tsconfig.json`.
  - Root pnpm override already uses the official package-manager strategy for Rolldown by aliasing `vite` to `npm:rolldown-vite`, but it is pinned to `7.1.9`; `apps/leaderboard-admin` directly pins `vite` to `npm:rolldown-vite@7.1.14`.
- Official changelog findings:
  - Nuxt 4.2 adds abort signals for `useAsyncData`, Vite Environment API as a Nuxt 5 preview, async-data handler extraction, and an experimental TypeScript plugin. This repo has no `useAsyncData`/`useFetch` in active Nuxt apps, so abort handling and handler extraction do not apply. Vite Environment API/`future.compatibilityVersion: 5` is intentionally not enabled because Nuxt documents it as experimental and a broad breaking-change opt-in.
  - Nuxt 4.3 adds route-rule layouts, ISR/SWR payload extraction, dev-mode payload extraction, disabling inherited layer modules, route groups in meta, `setPageLayout` props, `#server`, and the `statusCode`/`statusMessage` deprecation. Active app pages are shallow and use one default layout, no route groups, and no Nuxt `createError` status fields; the `#server` alias is not needed for the small faucet server surface.
  - Nuxt 4.4 adds `createUseFetch`/`createUseAsyncData`, Vue Router v5, typed layout props in `definePageMeta`, `useAnnouncer`/`NuxtAnnouncer`, `payloadExtraction: "client"`, `useCookie({ refresh })`, `clearNuxtState` reset, improved import protection, typed view transitions, normalize component names, and build profiling. Applicable here: add announcer support to app roots, announce faucet result changes, and expose `nuxt build --profile` through Moon. Not applicable: custom Nuxt fetch composables because active app API flows use raw `fetch`/GraphQL clients, typed layout props because app layouts are static, payload extraction because active routes are SPA/static with `ssr: false`, cookie refresh because no active `useCookie`, and view-transition types because no view transitions are configured.
- TypeScript 7 finding:
  - Official TypeScript 7 beta guidance says `@typescript/native-preview` provides `tsgo` and is designed to run beside TypeScript 6, but TypeScript 7.0 has no stable programmatic API until 7.1. Nuxt `typecheck` delegates to Vue/Nuxt tooling (`vue-tsc`) that imports the TypeScript API, so replacing Nuxt typecheck with `tsgo` directly would be unsound for Vue SFC coverage today. The safe path is to keep `nuxt typecheck` on supported `vue-tsc` and add no fake native Nuxt typecheck task.
- Version findings:
  - Latest Nuxt is `4.4.6`.
  - Latest `rolldown-vite` is `7.3.1`; official Vite docs say to use the package override/alias and pin a specific version because `rolldown-vite` is experimental.
  - Latest `vue-tsc` is `3.3.2` with peer `typescript >=5.0.0`.
