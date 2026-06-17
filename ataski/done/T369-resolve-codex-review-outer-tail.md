---
id: T369
title: "Resolve Codex review outer tail"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T06:54:00Z
updated_at: 2026-06-17T07:00:00Z
---

## Requirements

- Address the Codex review findings on PR #215 after the Gemini fixes.
- Keep final/canonical rows as the only source for finalized witness evidence and finalized commit anchors.
- Preserve pending outer action tails in the Actions API surfaces that are used to reconstruct the live outer action state for proof preconditions:
  - `queryOuterActions` must still be able to return the range from a final anchor through a pending tail.
  - `queryCommitAsePastSlot` must select a final commit anchor, but its returned `ase` must include subsequent outer actions even when they are not final yet.
- Regenerate or update the checked-in gql.tada bridge indexer introspection so the newly exposed `finalityStatus` and `markedAsCanonicalAt` fields are type-visible to `@zeko-labs/graphql` consumers.
- Preserve the withdrawal false-completed regression fixes from T366-T368.

## Test Plan

- TDD.
- RED: use the Codex review findings as regression evidence, then add focused Actions API tests that fail while pending outer tails are filtered out of `queryOuterActions` and `queryCommitAsePastSlot`.
- GREEN: relax only the outer tail filters that are needed for proof construction, update generated GraphQL typing metadata, rerun focused API/SDK validation, and rerun Codex review.

## RED Evidence

- `codex-review --mode branch` reported:
  - `[P1] Keep pending outer tail in commit ASE`: `commitAsePastSlot` filtered the `ase` rows to canonical rows, producing stale `commitAseTarget` values while a pending outer tail exists.
  - `[P1] Keep pending outer actions in state ranges`: `outerActions` filtered ranges to canonical rows, preventing callers from finding a current synced outer action state that lies in the pending tail.
  - `[P2] Regenerate the gql.tada bridge indexer introspection`: `packages/graphql/src/generated/bridge-indexer-env.d.ts` did not include the new finality fields.

## GREEN Evidence

- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
- `pnpm --dir packages/graphql exec gql.tada generate-output --tsconfig tsconfig.json` regenerated the bridge indexer gql.tada introspection successfully.
- `moon run actions-api:manual-db-test -f` remains blocked before assertions because Docker/OrbStack is not running.
