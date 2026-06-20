---
id: T394
title: "Guard bridge debug mode production host"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T09:26:18Z
updated_at: 2026-06-19T09:31:33Z
---

## Requirements

- Keep completed transaction table labels compact: verified completed operations should render `Completed`, not `Deposit Completed` or `Withdrawal Completed`; unverified completed operations should still render the yellow `Unindexed` label.
- Disable mock-backend debug mode on the exact production host `bridge.zeko.io`, regardless of local storage or runtime config.
- Keep debug mode available on `testnet.bridge.zeko.io` and non-production hosts when explicitly enabled.
- Explain the unindexed-to-completed transition logic to the user from the actual bridge-ui code path.

## Test Plan

- BDD.
- RED: add tests proving completed-table source does not render raw machine status text for completed rows, and `getBridgeDebugMode` forces `off` on `bridge.zeko.io` while still allowing `testnet.bridge.zeko.io` and other hosts.
- GREEN: implement compact completed label mapping and production-host debug guard, then run focused tests, bridge-ui lint, typecheck, and full bridge-ui tests.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operations-table.test.ts test/unit/debug-worker-seam.test.ts` failed before implementation:
  - `bridge-operations-table.test.ts` could not import `completedOperationTableStatus`, proving no compact completed-table mapping existed.
  - `debug-worker-seam.test.ts > forces debug mode off on the production bridge host` returned `mock-backend` instead of `off` for `hostname: "bridge.zeko.io"`.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operations-table.test.ts test/unit/debug-worker-seam.test.ts` passed after implementation.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 27 files, 147 tests.
