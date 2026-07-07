---
id: T465
title: "rename-history-and-show-transaction-time"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Rename the Bridge UI completed transaction section to "Transaction history".
- Show transaction date and HH:MM time in operation history rows.
- Do not commit or push.

## Test Plan

- DDD.
- Update date formatting tests and run focused bridge-ui unit tests.

## RED Evidence

- User observed the section title is misleading now that awaiting-inclusion rows appear there, and date lacks HH:MM.

## GREEN Evidence

- Renamed the section heading to "Transaction history" in `apps/bridge-ui/app/components/Bridge.vue`.
- Updated `formatOperationDate` to include 24-hour HH:MM time.
- Added unit coverage for date+time formatting.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/operation-timestamps.test.ts test/unit/bridge-operations-table.test.ts test/unit/pending-transactions.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
