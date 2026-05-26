---
id: T255
title: "Apply Nuxt 4.4 UI readiness improvements"
status: done
blockedBy: [T253, T254]
owner: codex
created_at: 2026-05-26T08:07:17Z
updated_at: 2026-05-26T08:07:17Z
---

## Requirements

- Apply any low-risk Nuxt 4.4 feature adoption that materially improves this repo's UIs or Nuxt 5 readiness.
- Prefer configuration and shared-layer changes over broad app rewrites.
- If `useAnnouncer` is applicable, add the required root component and use dynamic announcements only where existing UI flows have state changes without focus movement.
- If `payloadExtraction: 'client'` is applicable, enable it consistently where SSR/cached route behavior benefits and note that it aligns with `compatibilityVersion: 5` defaults.
- If typed layout props or custom `createUseFetch` is applicable, adopt it only where it removes existing indirection or duplicate request defaults.
- Leave a concise migration note if a reviewed Nuxt 4.4 feature is intentionally not adopted.

## Test Plan

- DDD: use the audit findings to select targeted changes, then validate affected Nuxt apps with existing Moon typecheck/build tasks and focused UI checks if a visible behavior changes.

## RED Evidence

- Audit selected only low-risk Nuxt features from 4.2, 4.3, and 4.4 for this repo: add Nuxt's announcer primitive where route and faucet-result announcements can improve accessibility, and expose Nuxt build profiling through Moon for bundle-performance investigation.
- Existing app roots do not include `<NuxtAnnouncer />`, so `useAnnouncer` cannot be used safely yet.
- Existing active Nuxt Moon tasks include `build` and some `analyze` tasks, but no consistent `nuxt build --profile` entrypoint for profiling Nuxt/Rolldown build behavior.

## GREEN Evidence

- Added `<NuxtAnnouncer />` to the active app roots for bridge, faucet, and leaderboard.
- Added `useAnnouncer()` calls to the faucet form flow so successful faucet requests are announced politely and faucet errors are announced assertively.
- Added `profile` Moon tasks for `bridge-ui`, `faucet-ui`, and `lb-ui`; `moon task <project>:profile` confirms each resolves to `nuxt build --profile`.
- Added `docs/NUXT_4_4_READINESS.md` with adopted and deferred Nuxt 4.2/4.3/4.4 feature decisions, including the TypeScript 7 native-checking decision.
- `moon run -f bridge-ui:typecheck faucet-ui:typecheck bridge-ui:lint faucet-ui:lint lb-ui:lint` passed on 2026-05-26.
- `moon run -f bridge-ui:build faucet-ui:build lb-ui:build` passed on 2026-05-26 with Nuxt 4.4.6 and Rolldown-Vite 7.3.1. Remaining warnings are existing local-build warnings: stale browserslist/baseline data, missing Sentry auth token, and o1js direct-eval/large bridge chunks.
