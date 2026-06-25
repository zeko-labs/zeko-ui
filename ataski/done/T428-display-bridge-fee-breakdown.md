---
id: T428
title: "Display bridge fee breakdown"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-500.
- Display bridge fees clearly in the bridge UI before the user sends.
- Static fees are 0.1 MINA for send/request plus 0.1 MINA for claim, for 0.2 MINA total.
- Deposit dynamic fees use L2 account creation at 0.1 MINA each for the helper account and recipient account when those accounts do not exist.
- Withdrawal dynamic fees use L1 account creation at 1 MINA each for the helper account and recipient account when those accounts do not exist.
- The UI must explain the maximum first-operation fee exposure without pretending to know account-existence state that the frontend has not fetched.
- Use existing plain CSS/Vue style and avoid adding a dependency.

## Test Plan

- BDD.
- RED: add failing tests for a fee view-model/helper and source-copy assertion that the UI displays the static fee and the possible account creation fees for deposit and withdrawal.
- GREEN: add the minimal helper/component markup needed to render the breakdown in the existing input panel.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: `app/components/bridgeFees` did not exist and `Inputs.vue` did not render a bridge fee notice.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
