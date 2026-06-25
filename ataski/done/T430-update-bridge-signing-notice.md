---
id: T430
title: "Update bridge signing notice"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-505.
- Update the bridge input notice copy to: `Bridging requires signing two transactions: 1) Send from the origin chain, then 2) Claim to the destination chain. Note: Ledger hardware wallets are not yet supported by Zeko Mainnet. Bridge minimum 2 MINA.`
- Keep the Zeko Mainnet display name sourced from the shared network label helper rather than hardcoding the label.
- Keep existing layout readable on desktop and mobile.

## Test Plan

- BDD.
- RED: update the existing copy test so it fails until the 2 MINA minimum sentence is present after the Ledger note and the shared network label helper is still used.
- GREEN: update the copy in `Inputs.vue`.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: `Inputs.vue` still omitted `Bridge minimum 2 MINA.` after the Ledger hardware wallet notice.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
