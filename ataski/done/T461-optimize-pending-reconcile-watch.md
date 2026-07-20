---
id: T461
title: "optimize-pending-reconcile-watch"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Address review feedback in `apps/bridge-ui/app/components/Bridge.vue`.
- Avoid reconciling pending transactions from a `watchEffect` that reacts to every `allOperations` object refresh.
- Watch a stable transaction hash key so localStorage reconciliation only runs when the relevant hashes, wallet, or bridge network scope change.
- Do not change bridge protocol or transaction semantics.
- Do not commit or push.

## Test Plan

- DDD.
- This is a reactive performance fix. Validate with `bridge-ui:lint` and `bridge-ui:typecheck`.

## RED Evidence

- Review identified redundant localStorage reconciliation from `watchEffect` tracking `allOperations.value.transactionHashes` array references.

## GREEN Evidence

- Replaced `watchEffect` with a `transactionHashesKey` computed string and `watch` over the stable hash key, bridge scope, and wallet address.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
