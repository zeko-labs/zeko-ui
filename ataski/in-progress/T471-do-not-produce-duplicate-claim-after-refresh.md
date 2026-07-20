---
id: T471
title: "do-not-produce-duplicate-claim-after-refresh"
status: in-progress
blockedBy: []
owner: pi
created_at: 2026-07-17T00:00:00Z
updated_at: 2026-07-17T12:32:00Z
---
## Requirements

- Bugfix: after a claim/finalize transaction has already been submitted and is pending, refreshing/opening another tab must not produce another claim prompt for the same operation.
- Keep transactions table showing `Finalizing` until indexed completion.
- Avoid broad recovery rewrites; make the smallest behavior fix at the claimability boundary.
- Do not commit or push.
- Regression reported after initial fix: finalizing marker is removed too early when the local operation moves to unverified completed state, so refresh/new tab can recover the same action as claimable again.

## Test Plan

- TDD.
- Add focused regression coverage for recovered claimable state when local pending storage already marks the operation as finalizing.
- Add regression coverage that pending storage reconciliation does not remove locally finalizing/unverified completed operations before backend completion is verified.
- Implement the minimal source change needed to prevent duplicate claim prompt while preserving unclaimed claimable operations.

## RED Evidence

- Added focused bridge operation tests for:
  - a recovered withdrawal with matching local `finalizing` pending storage must complete unverified instead of returning to claim;
  - withdrawal finalization submit must persist `finalizing` against the original transaction hash.
- Added follow-up reconciliation regression test; `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-reconciliation.test.ts` failed because the reconciliation helper did not exist yet.

## GREEN Evidence

- Kept fix local/uncommitted for review; no push performed.
- Bugfix is limited to finalizing-state persistence/reconciliation boundaries:
  - finalization submit stores original operation hash as `finalizing`;
  - recovered claimable operation with matching local `finalizing` storage completes as unverified instead of returning to claim;
  - local pending storage is reconciled only after backend completion is verified, so refresh/new tab keeps the `finalizing` marker while claim indexing is still pending.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operation.test.ts -t "local pending storage says withdrawal is finalizing|persists finalizing status"` passed.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-reconciliation.test.ts test/unit/bridge-operation.test.ts -t "local pending storage says withdrawal is finalizing|persists finalizing status|pending transaction reconciliation"` passed.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format-fix -f` then `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
