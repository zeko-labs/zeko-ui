---
id: T154
title: "Capture app root errors in Sentry"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:30:03Z
updated_at: 2026-03-24T15:55:56Z
---

## Requirements

- Add an explicit client-side root error capture layer for bridge-ui so app-originated render and unhandled errors reach Sentry even when generic auto-capture would otherwise be filtered.
- Introduce a small internal helper `captureAppRootError` that:
  - tags events with `app_originated=true`
  - tags events with `error_surface` set to `vue-render`, `window-error`, or `unhandledrejection`
  - accepts optional route, component, and info context
  - deduplicates repeated captures for the same thrown object with a local `WeakSet`
- Wire the helper from a Nuxt client plugin that:
  - wraps the Vue app error handler
  - listens for `window` `error`
  - listens for `window` `unhandledrejection`
- Update the Sentry client filter path so `third_party_code` events are dropped only when the event is not explicitly marked `app_originated`.
- Preserve all existing intentional filters for `QuietError`, wallet rejections, empty-object rejections, aborted requests, browser-extension noise, and true third-party-only frames.
- Add focused unit tests for the helper and the `beforeSend` filter behavior.

## Test Plan

- TDD.
- RED first: add failing tests proving app-originated events tagged with `third_party_code` are currently dropped and that the new helper contract is not yet implemented.
- GREEN second: implement the helper, plugin wiring, and filter behavior, then rerun the targeted tests plus full `bridge-ui:test`.

## RED Evidence

- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" moon run bridge-ui:prepare -f` was required in the new worktree so browser-mode vitest could load `.nuxt`.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" vitest run test/unit/sentry-client-config.test.ts --config vitest.config.ts` currently fails against the new test harness, proving the root-error capture path has not been implemented and the config is not yet structured for the expected app-originated retention behavior.
- The RED test encodes the requirement that `app_originated=true` events survive `third_party_code` filtering while third-party-only events continue to be dropped.

## GREEN Evidence

- Added `apps/bridge-ui/app/telemetry/appRootErrors.ts` and `apps/bridge-ui/app/telemetry/sentryClient.ts`, then wired the client plugin and Sentry config to keep `app_originated=true` root errors even when `third_party_code` is present.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" vitest run test/unit/operation-timestamps.test.ts test/unit/sentry-client-config.test.ts test/unit/app-root-errors.test.ts --config vitest.config.ts` passes with the explicit app-root capture/filter coverage green.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" moon run bridge-ui:test -f` passes in the feature worktree with the new app-root capture layer enabled.
