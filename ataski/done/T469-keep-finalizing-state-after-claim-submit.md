---
id: T469
title: "keep-finalizing-state-after-claim-submit"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-15T00:00:00Z
updated_at: 2026-07-15T00:00:00Z
---
## Requirements

- After a claim/finalize transaction is submitted, the UI must remain in `Finalizing` and must not prompt the user to claim/sign again while the indexer has not yet observed finalization.
- Local pending transaction rows should remain until a real indexed completed/history row replaces them.
- Transactions table should not show a second history row for the claim/finalize transaction; it should keep one bridge operation row keyed to the original deposit/withdrawal request hash.
- Preserve existing pending/awaiting-claim behavior before finalization submission.
- Do not commit or push.

## Test Plan

- TDD/DDD hybrid.
- Add/adjust unit coverage for finalizing local pending status and history row hash selection.
- Run focused bridge-ui tests, typecheck, lint, and format.

## RED Evidence

- After finalization submit, the UI can re-offer claim until the indexer reports finalization.
- History can show both the original request transaction and the claim/finalize transaction.

## GREEN Evidence

- Unverified locally completed operations now render as `Finalizing` instead of generic `Pending`.
- Transactions table rows now prefer the original submit/request hash over recovered/finalization hashes, preventing a claim/finalize hash from replacing the bridge operation hash.
- Completed unverified operation actors are included in local pending status tracking so persisted rows can remain `Finalizing` until indexed completion replaces them.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
