---
id: T431
title: "Block bridge transfers below two MINA"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-506.
- Prevent bridge send operations below 2 MINA before wallet signing.
- The Send button must remain disabled for no amount, invalid amount, zero, negative values, and values under 2.
- Valid amounts at or above 2 MINA must remain sendable when the bridge is ready and a wallet address exists.
- The minimum rule should be testable without mounting the full Nuxt app.

## Test Plan

- BDD.
- RED: add a failing helper-level test for the send-button eligibility/minimum amount rule.
- GREEN: extract or add a small helper used by `Inputs.vue` so the UI blocks sub-2 MINA sends before dispatching `StartOperation`.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: `app/components/bridgeInputs` did not exist and `Inputs.vue` did not use `canStartBridgeOperation` or `BRIDGE_MINIMUM_AMOUNT_MINA`.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
