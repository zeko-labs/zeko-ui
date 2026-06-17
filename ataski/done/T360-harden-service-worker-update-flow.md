---
id: T360
title: "Harden service worker update flow"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:17:45Z
updated_at: 2026-06-17T07:25:40Z
---

## Requirements

- Address the accepted Codex review findings for the bridge UI service worker update flow.
- Ensure app-only deploys change the generated service worker script so browser update checks can produce a waiting worker and show the in-app update notice.
- Ensure tabs that did not click the update prompt still reload if another tab activates the new worker; a later click in this tab must not leave the update action stuck waiting for a controllerchange that already happened.
- Address Gemini review comments in `updateRefresh.ts`: guard the installing worker state check and make a failed `registration.update()` check non-fatal after successful service worker registration.
- Preserve the core user constraint: service worker updates must not automatically disrupt an active session before a user accepts the in-app update prompt.

## Test Plan

- TDD. First add focused service worker tests for non-fatal update-check failure, newly installed worker notification, cross-tab controller activation, and service worker build fingerprinting.
- RED path: run the focused bridge UI service worker test and capture failures against the current implementation.
- GREEN path: implement the worker/update flow changes, then rerun the focused service worker tests, bridge UI typecheck/build, and Codex review.

## RED Evidence

- `moon run bridge-ui:test -f -- service-worker-refresh.test.ts` failed as expected: `serviceWorkerSource` did not contain `__WB_MANIFEST`, rejected `registration.update()` caused `registerBridgeServiceWorker` to reject, and late acceptance after another tab activated still posted `BRIDGE_UI_SKIP_WAITING` instead of reloading the already-controlled tab.

## GREEN Evidence

- `moon run bridge-ui:test -f -- service-worker-refresh.test.ts` passed: 1 file, 8 tests.
- `moon run bridge-ui:test -f -- service-worker-refresh.test.ts service-worker-update-store.test.ts` passed: 2 files, 9 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:build -f` passed.
- `rg -n "BRIDGE_UI_BUILD_FINGERPRINT|_nuxt/builds|__WB_MANIFEST" apps/bridge-ui/.output/public/sw.js` confirmed the emitted worker includes the build fingerprint message path and injected `_nuxt/builds/...` revision entries.
- `moon run bridge-ui:lint -f` passed.
