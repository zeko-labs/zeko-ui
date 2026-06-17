---
id: T361
title: "Resolve service worker follow-up review"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:32:07Z
updated_at: 2026-06-17T07:35:27Z
---

## Requirements

- Address accepted Codex review findings from the second branch review pass.
- Detect and announce a replacement worker when `navigator.serviceWorker.register()` returns a registration whose `installing` worker is already present, even if the `updatefound` event fired before listeners were attached.
- Disable the generated `@vite-pwa/nuxt` client registration plugin so the bridge UI has one service worker registration/update state machine: the custom clickable update prompt path.
- Preserve user-driven update activation; no automatic page reload before the user accepts the in-app update notice.

## Test Plan

- TDD. First extend focused service worker tests to fail when an already-installing registration is not tracked and when Nuxt PWA client registration is not disabled.
- RED path: run `moon run bridge-ui:test -f -- service-worker-refresh.test.ts` and capture the expected failures.
- GREEN path: implement the focused service worker and Nuxt PWA config changes, then rerun focused bridge UI tests, typecheck, build/proof, and Codex review.

## RED Evidence

- `moon run bridge-ui:test -f -- service-worker-refresh.test.ts` failed as expected: `nuxt.config.ts` did not contain `client: { registerPlugin: false }`, and a registration with an already-present `installing` worker did not call `onUpdateAvailable` after that worker reached `installed`.

## GREEN Evidence

- `moon run bridge-ui:test -f -- service-worker-refresh.test.ts service-worker-update-store.test.ts` passed: 2 files, 11 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:build -f` passed.
- `! rg "vite-pwa:nuxt:client:plugin|useRegisterSW|messageSkipWaiting" apps/bridge-ui/.output/public/_nuxt apps/bridge-ui/.output/server` passed, confirming the generated Vite PWA client registration path is absent from the built app bundles.
- `rg -n "BRIDGE_UI_BUILD_FINGERPRINT|_nuxt/builds" apps/bridge-ui/.output/public/sw.js` passed, confirming the emitted service worker still includes the build fingerprint path and injected build metadata.
