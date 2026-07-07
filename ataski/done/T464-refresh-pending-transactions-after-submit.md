---
id: T464
title: "refresh-pending-transactions-after-submit"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Pending bridge transactions saved after submit must appear in the Completed Transactions table without requiring a page refresh.
- Keep existing refresh persistence behavior.
- Do not commit or push.

## Test Plan

- DDD.
- Add unit coverage for same-tab pending transaction change notification.
- Run focused bridge-ui tests.

## RED Evidence

- User observed a submitted transaction only appeared in Completed Transactions after refreshing the page.

## GREEN Evidence

- Added same-tab pending transaction change event emission after successful pending storage writes.
- `Bridge.vue` now listens for that event and re-loads pending transactions without requiring a page refresh.
- Made pending transaction unit tests deterministic with a fixed clock.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
