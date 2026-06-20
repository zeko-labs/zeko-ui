---
id: T396
title: "Remove runtime debug mode fallback"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T11:45:45Z
updated_at: 2026-06-19T11:50:53Z
---

## Requirements

- Debug mode must be controlled only by the browser localStorage key used by `BRIDGE_DEBUG_MODE_STORAGE_KEY`.
- Remove the Nuxt public runtime/env fallback so `NUXT_PUBLIC_BRIDGE_DEBUG_MODE=mock-backend` cannot enable debug mode.
- Keep the production host guard: `bridge.zeko.io` must always resolve debug mode to `off`.
- Keep debug mode available on `testnet.bridge.zeko.io`, localhost, and other non-production hosts when localStorage explicitly contains `mock-backend`.
- Return the correct console one-liners for enabling and disabling debug mode.

## Test Plan

- TDD.
- RED: update the debug-mode seam test so a runtime/env `mock-backend` value without localStorage resolves to `off`.
- GREEN: remove runtime config from the debug-mode seam and bridge store, then run focused tests, lint, typecheck, and the full bridge-ui tests.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/debug-worker-seam.test.ts` failed before implementation.
- Failure: `ignores runtime debug mode when no local override is set` received `mock-backend` from `runtimeMode: "mock-backend"` instead of `off`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/debug-worker-seam.test.ts` passed after implementation.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 148 tests.
