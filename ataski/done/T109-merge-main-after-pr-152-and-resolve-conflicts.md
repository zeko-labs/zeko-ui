---
id: T109
title: "Merge main after PR 152 and resolve conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T20:56:00Z
updated_at: 2026-03-19T21:35:00Z
---

## Requirements

- Merge the latest `origin/main` into `canonical/bridge-cli` after PR 152 merged.
- Resolve merge conflicts without dropping the bridge-cli changes that still belong on the canonical branch.
- Preserve the now-merged bridge-sdk/UI work from `main` and adapt the bridge-cli branch so it is ready for another agent to review and test.
- Run the relevant automated validation after conflict resolution and push the updated canonical branch.

## Test Plan

- DDD
- Use the merge itself as the discovery step for the actual conflict set.
- After resolving conflicts, rerun the bridge-cli and affected package verification needed to prove the merged branch is review-ready.

## RED Evidence

- `origin/main` now contains `e3af225` (`feat(bridge): fee withdrawl errors and sdk improvements (#152)`), which overlaps with the canonical bridge-cli branch because PR 152 was split out and merged independently.
- The canonical branch is still based on pre-merge `main`, so it must integrate the newly merged bridge-sdk/UI changes before another review pass.

## GREEN Evidence

- Merged `origin/main` into `canonical/bridge-cli` and resolved the overlapping bridge-sdk/UI/GraphQL conflicts without reintroducing the rejected local `canFinalizeDepositDetailed` / `canCancelDepositDetailed` / `canFinalizeWithdrawalDetailed` methods.
- Preserved `main`'s capability-method contract and adapted bridge-cli to consume the diagnostic-returning methods directly.
- Validation passed:
  - `pnpm --dir apps/bridge-ui exec nuxt typecheck`
  - `moon run bridge-sdk:test bridge-sdk:typecheck bridge-ui:test bridge-ui:typecheck bridge-cli:test bridge-cli:typecheck bridge-cli:build graphql:typecheck`
