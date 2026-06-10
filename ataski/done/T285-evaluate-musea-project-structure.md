---
id: T285
title: "Evaluate Musea project structure"
status: done
blockedBy: [T284]
owner: codex
created_at: 2026-06-10T00:00:00+07:00
updated_at: 2026-06-10T00:00:00+07:00
---

## Requirements

- Determine whether Musea should live inside each Nuxt app, the shared Nuxt layer, or a dedicated package with its own `package.json`.
- Prefer the structure that matches this monorepo's Moon ownership, shared design-system usage, and Nuxt layer composition.
- Add only the minimum Musea configuration needed to prove the structure.
- Document the decision and tradeoffs in `docs/vize-migration.md`.

## Test Plan

- DDD: inspect the layer and app component ownership first, then test the selected Musea route or package command.
- Validate with Moon commands and local server startup where possible.

## RED Evidence

- `moon run musea:typecheck` initially failed on the inherited root `baseUrl` deprecation under TypeScript 6.
- `pnpm --filter @zeko/musea exec vize check src vite.config.ts` currently does not resolve the pnpm workspace package graph for this package: it misses CSS side-effect imports, Vite exports, and direct Vize/Musea package types.
- `moon run musea:typecheck` then exposed Playwright dependency declaration errors from Musea's dependency graph under TypeScript 6; the package now uses `skipLibCheck` so the task checks local package code without failing on external declarations.
- `moon run musea:build` emits Vite alias warnings for repeated `vue/dist/vue.esm-bundler.js` non-absolute rewrites. A `resolve.dedupe: ["vue"]` trial did not remove the warning.

## GREEN Evidence

- Added dedicated `@zeko/musea` workspace package with Moon `dev`, `build`, `typecheck`, `lint`, and `format` tasks.
- Added Vite Musea configuration using `@vizejs/vite-plugin` and `@vizejs/vite-plugin-musea`.
- Added one `Button.art.vue` proof for `packages/layer/app/components/Button.vue`.
- `moon run musea:dev` started successfully on `http://127.0.0.1:6077/`; Musea found one art file and exposed `http://localhost:6077/__musea__`.
- `curl -I http://127.0.0.1:6077/__musea__` returned `200 OK`.
- `moon run musea:build` completed successfully with Vite `8.0.16`, Vize native precompilation, and one Musea art file.
- `moon run musea:typecheck` completed successfully after package-local TypeScript declarations and dependency lib-check scoping.
