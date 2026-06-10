---
id: T286
title: "Validate Vize production builds"
status: done
blockedBy: [T284, T285]
owner: codex
created_at: 2026-06-10T00:00:00+07:00
updated_at: 2026-06-10T00:00:00+07:00
---

## Requirements

- Run production builds for Vize-enabled Nuxt projects after dev-server and Musea checks are understood.
- Capture build failures, warnings, and any required compatibility toggles in `docs/vize-migration.md`.
- Keep Cloudflare-oriented build behavior in scope for apps that deploy to Workers.
- Do not remove existing production build tasks until replacements are proven.

## Test Plan

- DDD: use dev-server and Musea evidence to select the production build matrix, then run focused Moon build/typecheck commands.
- At minimum, validate `faucet-ui:build`, `lb-ui:build`, and `bridge-ui:build` or document the first blocker that prevents reaching them.

## RED Evidence

- App-level `@vizejs/nuxt` production build trial failed during Nitro bundling:
  - `moon run -f faucet-ui:build` reached Nuxt client and server Vite builds, then failed in Nitro with a Rollup error because generated SSR output imported a default export from `vue/index.mjs`.
  - `moon run -f lb-ui:build` reproduced the same Nitro failure shape.
- Tried mitigations:
  - `vize.compiler.ssr: false` in app configs and the layer playground.
  - Faucet-local Vite CommonJS `requireReturnsDefault` override.
- Neither mitigation fixed the Nitro Vue default-import failure, so app-level `@vizejs/nuxt` wiring was removed from the final PR state.

## GREEN Evidence

- `moon run -f faucet-ui:build`: passed after removing app-level `@vizejs/nuxt` wiring.
- `moon run -f lb-ui:build`: passed after removing app-level `@vizejs/nuxt` wiring.
- `moon run -f bridge-ui:build`: passed after removing app-level `@vizejs/nuxt` wiring.
- `moon run -f musea:build`: passed with Vite `8.0.16`, Vize native precompilation, and one Musea art file.
- `moon run -f musea:format`: passed after applying the package formatter with `moon run -f musea:format-fix`.
- `moon run -f musea:typecheck`: passed.
- `moon run -f musea:lint`: passed.
- Documented the production blocker, final safe structure, and remaining Musea alias warning in `docs/vize-migration.md`.
