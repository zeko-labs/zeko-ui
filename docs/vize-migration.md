# Vize Migration Trial

## Baseline

- Branch: `branch/nuxt-4-4-prep`
- Baseline commit before Vize trial changes: `bf3f6e917daae4524b5e0bcb5d6825e60a7a4b0d`
- Date started: 2026-06-10

## Current Repo Shape

- Nuxt apps: `apps/bridge-ui`, `apps/faucet-ui`, `apps/leaderboard-ui`
- Shared Nuxt layer: `packages/layer`
- Existing Vue lint path: Biome per app through Moon `lint` and `lint-fix`
- Existing repo format path: root Moon `format-all` and `format-all-fix`
- Existing Nuxt typecheck path: `nuxt typecheck` or `nuxi typecheck`

## Trial Order

1. Verify existing dev servers before Vize configuration changes.
2. Add Vize in the least invasive Nuxt path and retest dev servers.
3. Evaluate Musea structure, including whether a dedicated package is cleaner than app-local setup.
4. Run production builds and capture build-specific compatibility issues.

## Log

### 2026-06-10

- Created migration log at the baseline commit above.
- Installed dependencies after `node_modules` cleanup with `pnpm install`; Nuxt prepare completed for the layer and Nuxt apps.
- Baseline dev servers before Vize changes:
  - `moon run faucet-ui:dev`: started successfully at `http://localhost:3080/`.
  - `moon run lb-ui:dev`: started successfully at `http://localhost:3069/`.
  - `moon run bridge-ui:dev`: started successfully at `http://localhost:3090/`.
- Baseline Nuxt stack reported by dev servers: Nuxt `4.4.6`, Nitro `2.12.6`, Rolldown-Vite `7.3.1`, Vue `3.5.34`.
- Added Vize trial dependencies through the workspace catalog:
  - `@vizejs/nuxt` `0.195.0`
  - `@vizejs/vite-plugin-musea` `0.195.0`
  - `vize` `0.195.0`
  - `vite` `^8.0.16`
- Updated the Nuxt catalog entry to `4.4.8` and removed the previous `vite: npm:rolldown-vite@7.3.1` override for this trial.
- Added a shared root `vize.config.ts` covering the three Nuxt app `app/**/*.vue` trees and the shared layer `app/**/*.vue` plus playground Vue files.
- Added `@vizejs/nuxt` to the bridge, faucet, leaderboard, and layer playground Nuxt module lists with `vize.compiler` enabled.
- `pnpm install` completed after the Vize wiring. Relevant peer findings:
  - Nuxt devtools, `@vite-pwa/nuxt`, and `@vitest/browser` still declare Vite peer ranges that stop before Vite 8.
  - `@vizejs/musea-nuxt` currently declares `vue-router@^4.5.0`, while the Nuxt 4 apps resolve Vue Router 5.x.
  - Existing TypeScript 6 native-preview peer warnings remain from gql.tada, tsdown, Lumina, and related packages.
- Vize-enabled dev servers:
  - `moon run faucet-ui:dev`: started successfully at `http://localhost:3080/`.
  - `moon run lb-ui:dev`: started successfully at `http://localhost:3069/`.
  - `moon run bridge-ui:dev`: started successfully at `http://localhost:3090/`.
- Vize-enabled Nuxt dev servers reported Nuxt `4.4.8`, Nitro `2.12.6`, Vite `7.3.5`, Vue `3.5.35`.
- Dependency-resolution note: direct app-level `vite` resolves to `8.0.16`, but `@nuxt/vite-builder@4.4.8` still installs and runs `vite@7.3.5`; the catalog Vite 8 entry does not currently change the Nuxt dev-server Vite runtime.
- Production-build finding: app-level `@vizejs/nuxt` is not kept in the final PR state. With the Nuxt compiler module enabled in the apps, both `faucet-ui:build` and `lb-ui:build` reached the Nuxt client/server Vite phases but failed during Nitro bundling with a Rollup error where the generated SSR output imported a default export from `vue/index.mjs`. Testing `vize.compiler.ssr: false` and a Vite CommonJS `requireReturnsDefault` override did not fix the Nitro failure.
- Final PR state after the production blocker: keep Vize/Musea isolated to the dedicated `packages/musea` Vite project, keep the root `vize.config.ts` as trial configuration, and do not enable `@vizejs/nuxt` in the production Nuxt app configs yet.

## Musea Structure Decision

Use a dedicated workspace package at `packages/musea` instead of embedding Musea in each Nuxt app or the shared Nuxt layer.

Reasons:

- Musea's recommended workflow is `@vizejs/vite-plugin-musea` on a Vite dev server with `*.art.vue` files and a `/__musea__` route.
- The Nuxt apps should not carry gallery-only routes, preview setup, VRT commands, or gallery build output in their production app configs.
- The shared layer is a Nuxt layer plus playground; it should remain the source of shared components/styles rather than becoming the gallery host.
- A dedicated `packages/*` project fits the existing Moon and pnpm workspace discovery and can depend on `layer` and `design` explicitly.

Implemented proof:

- Added `@zeko/musea` with its own `package.json`, `moon.yml`, `vite.config.ts`, `tsconfig.json`, preview setup, and one `Button.art.vue` file for the shared layer button.
- Added root `vize.config.ts` Musea defaults for `packages/musea/src/**/*.art.vue`.
- `moon run musea:dev`: started successfully on `http://127.0.0.1:6077/`; Musea reported one art file and exposed `http://localhost:6077/__musea__`.
- `curl -I http://127.0.0.1:6077/__musea__`: returned `200 OK`.
- `moon run musea:build`: completed with Vite `8.0.16`, Vize native precompilation, and one Musea art file.
- `moon run musea:typecheck`: completed after adding package-local CSS/PostCSS declarations and `skipLibCheck` for dependency declaration compatibility.

Current Musea build warning:

- `moon run musea:build` emits Vite alias warnings that rewrite `vue/dist/vue.esm-bundler.js` into a repeated non-absolute path. Adding `resolve.dedupe: ["vue"]` did not remove the warning, so this appears to be in the Vize/Musea plugin resolution path rather than the local package structure.

## Production Build Validation

Final validation was run after removing app-level `@vizejs/nuxt` wiring from the Nuxt apps and the layer playground.

- `moon run -f faucet-ui:build`: passed. Nuxt reported Nuxt `4.4.8`, Nitro `2.12.6`, Vite `7.3.5`, Vue `3.5.35`, and the `cloudflare-module` Nitro preset.
- `moon run -f lb-ui:build`: passed. Nuxt reported the same Nuxt/Nitro/Vite/Vue stack and the `cloudflare-module` Nitro preset. The dependency `graphql:build` emitted its existing tsdown `resolve.tsconfigFilename` deprecation warning.
- `moon run -f bridge-ui:build`: passed. The main Nuxt build used Vite `7.3.5`; the PWA service-worker build used workspace Vite `8.0.16`. Existing warnings remained for o1js `eval`, large bridge chunks, missing local Sentry auth token, and tsdown `resolve.tsconfigFilename`.
- `moon run -f musea:build`: passed with Vite `8.0.16`, Vize native precompilation, and one Musea art file. The Vite alias duplication warning remains as noted above.
- `moon run -f musea:format`: passed after one CSS indentation fix from `moon run -f musea:format-fix`.
- `moon run -f musea:typecheck`: passed.
- `moon run -f musea:lint`: passed.

Conclusion: this PR is safe as a Musea/Vize adoption trial if the Nuxt compiler module remains disabled for production apps. The next Nuxt compiler attempt should start by isolating the generated Vue default-import issue in Nitro SSR output before re-enabling `@vizejs/nuxt` in app configs.
