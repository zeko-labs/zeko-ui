---
id: T466
title: "preserve-pending-withdrawals-after-refresh"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Pending Zeko-to-Mina withdrawal transactions must remain visible after browser reload, matching Mina-to-Zeko deposits.
- Preserve existing pending deposit behavior.
- Do not commit or push.

## Test Plan

- DDD.
- Add regression coverage for withdrawal pending records scoped by the same wallet/network pair used by the UI.
- Run focused pending transaction tests and relevant table tests.

## RED Evidence

- User observed Zeko mainnet to Mina mainnet withdrawal showed `Awaiting inclusion`, then disappeared after browser auto reload.

## GREEN Evidence

- Updated `apps/bridge-ui/app/components/Bridge.vue` so pending local transactions are reconciled only when an operation has an indexed `actionIndex`.
- This prevents locally submitted, not-yet-indexed withdrawal hashes from deleting their own pending localStorage record after reload.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
