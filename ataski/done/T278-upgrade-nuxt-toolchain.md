---
id: T278
title: "Upgrade Nuxt toolchain"
status: done
blockedBy: [T277]
owner: codex
created_at: 2026-05-26T08:07:17Z
updated_at: 2026-05-26T08:32:00Z
---

## Requirements

- Upgrade the shared Nuxt catalog dependency from the current 4.1.x line to the latest safe 4.4.x release, preserving pnpm catalog and workspace conventions.
- Update related Nuxt/Vue/Vite/Rolldown dependencies only when required by the Nuxt 4.4 upgrade or by documented performance guidance.
- Preserve the existing `pnpm.overrides.vite` strategy if it matches official Rolldown guidance; otherwise adjust it to the documented package-manager override form.
- Do not add package scripts; use Moon tasks and `pnpm exec` only when a command is not represented in `moon.yml`.
- Update the lockfile through `pnpm i` after manifest changes.

## Test Plan

- DDD with a test strategy exception for dependency-only changes: capture the pre-change toolchain state and expected dependency delta before editing, then verify with Moon typecheck/build tasks after implementation.

## RED Evidence

- Baseline before manifest edits: shared Nuxt catalog is `4.1.1`; npm reports latest Nuxt `4.4.6`.
- Baseline before manifest edits: root `pnpm.overrides.vite` is `npm:rolldown-vite@7.1.9`; `apps/leaderboard-admin` direct Vite alias is `npm:rolldown-vite@7.1.14`; npm reports latest `rolldown-vite` `7.3.1`.
- Baseline before manifest edits: `apps/bridge-ui` and `apps/faucet-ui` pin `vue-tsc` `^3.0.6`; npm reports latest `vue-tsc` `3.3.2` and peer `typescript >=5.0.0`.
- Test Strategy Exception: this task changes dependency pins and lockfile state. There is no meaningful failing unit test to write first; correctness will be established by package install plus Nuxt typecheck/build validation.

## GREEN Evidence

- Updated the workspace catalog to Nuxt `4.4.6`, Vue `3.5.34`, Vue Router `5.0.7`, Pinia `3.0.4`, `@pinia/nuxt` `0.11.3`, `vue-tsc` `3.3.2`, and `vite` as `npm:rolldown-vite@7.3.1`.
- Normalized active Nuxt package manifests to use the catalog for Nuxt-adjacent dependencies where they had stale direct pins.
- Kept TypeScript on supported `5.9.3` for `nuxt typecheck`; TypeScript 7 native `tsgo` is not a supported replacement for Nuxt/Vue typechecking yet because Nuxt delegates through Vue/Nuxt tooling that uses the TypeScript API.
- `pnpm i` completed successfully after forcing a clean worktree relink; remaining peer warnings are pre-existing URQL/vitepress peer range warnings and the expected experimental `rolldown-vite` deprecation notice.
- `moon run -f bridge-ui:typecheck faucet-ui:typecheck` passed on 2026-05-26 after the dependency upgrade.
