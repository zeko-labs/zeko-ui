---
id: T284
title: "Integrate Vize Nuxt compiler trial"
status: done
blockedBy: [T283]
owner: codex
created_at: 2026-06-10T00:00:00+07:00
updated_at: 2026-06-10T00:00:00+07:00
---

## Requirements

- Add Vize dependencies through the workspace catalog and app package manifests.
- Add shared Vize configuration for the repo's Nuxt app and layer paths.
- Wire `@vizejs/nuxt` into Nuxt projects in the least invasive way that lets us test dev servers.
- Keep the existing Nuxt build/typecheck tasks available until Vize behavior is validated.
- Document every compatibility issue and workaround in `docs/vize-migration.md`.

## Test Plan

- DDD: use the baseline dev-server results from T283 to compare the Vize-enabled server startup behavior.
- Run focused Moon dev commands for faucet UI first, then leaderboard UI, then bridge UI.

## RED Evidence

- Before adding direct `vite` devDependencies to all Vize-enabled Nuxt app manifests, `pnpm install` reported missing Vite peer dependencies for Vize in the apps without direct Vite entries.
- After switching the catalog Vite entry to `^8.0.16`, `pnpm install` continued to report Vite 8 peer-range warnings from Nuxt devtools, `@vite-pwa/nuxt`, and `@vitest/browser`.
- `@vizejs/musea-nuxt` reports a `vue-router@^4.5.0` peer while the Nuxt 4 apps resolve Vue Router 5.x.

## GREEN Evidence

- `pnpm install` completed successfully after adding direct `vite` devDependencies where needed.
- Added `@vizejs/nuxt` to the Nuxt apps and layer playground with shared root `vize.config.ts`.
- `moon run faucet-ui:dev` started successfully at `http://localhost:3080/` with Nuxt `4.4.8`.
- `moon run lb-ui:dev` started successfully at `http://localhost:3069/` with Nuxt `4.4.8`.
- `moon run bridge-ui:dev` started successfully at `http://localhost:3090/` with Nuxt `4.4.8`.
- The Vize-enabled dev servers report Vite `7.3.5` because `@nuxt/vite-builder@4.4.8` still resolves its own Vite runtime, even though direct app-level `vite` resolves to `8.0.16`.
