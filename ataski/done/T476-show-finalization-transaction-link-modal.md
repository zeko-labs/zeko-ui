---
id: T476
title: "show-finalization-transaction-link-modal"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-15T00:00:00Z
updated_at: 2026-07-15T00:00:00Z
---

## Requirements

- When `finalizeDeposit` or `finalizeWithdrawal` submits successfully, show a simple modal with the finalization transaction hash and an explorer link.
- Use the finalization transaction hash returned by the SDK transaction result; do not rely on indexed history.
- Link deposit finalization hashes to the destination Zeko explorer and withdrawal finalization hashes to the destination Mina explorer.
- Do not change the Transactions table history semantics.
- Keep UI simple, keyboard-accessible, and dismissible.

## Test Plan

- TDD/DDD hybrid.
- Add helper tests for destination-network explorer URLs.
- Run focused bridge-ui tests, typecheck, lint, and format.

## RED Evidence

- Finalization transaction hashes are stored in operation actor context but are not surfaced to the user with an explorer link.

## GREEN Evidence

- Added destination-network explorer URL helper for finalization hashes.
- Bridge UI now watches operation actor context for `finalizeDeposit`/`finalizeWithdrawal` transaction results and shows a dismissible modal with the hash and explorer link.
- Modal does not change Transactions table history semantics and only uses the in-memory SDK result hash.
- Added unit coverage for finalization explorer URLs.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
