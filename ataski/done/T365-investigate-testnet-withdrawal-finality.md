---
id: T365
title: "Investigate testnet withdrawal finality"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T00:00:00Z
updated_at: 2026-06-17T05:30:00Z
---

## Requirements

- Investigate why testnet bridge withdrawals can appear deducted on L2 but not credited on L1 while the UI transitions from pending to completed after refresh.
- Determine whether backend indexer state, actions API status mapping, SDK reconciliation, or bridge UI display logic can mark an unfinalized withdrawal as completed.
- Explain the likely root cause, why it happened, backend remediation, and UI remediation.
- Provide an explicit confidence level for each conclusion and identify evidence gaps.
- Do not edit source code in this task. If implementation is needed, create follow-up Ataski tasks with concrete requirements and test-first plans before source edits.

## Test Plan

- Investigation-only task. No source-code edits are in scope.
- Validate by static code tracing across indexer, actions API, SDK, validator, and UI status display paths.
- If live endpoint credentials or deterministic reproductions are available, use them only to confirm observations; do not mutate production or testnet backend state.

## RED Evidence

Not applicable for investigation-only work with no source-code edits.

## GREEN Evidence

- Static trace: `packages/bridge-sdk/src/withdrawals.ts` derives withdrawal `finalised` from the L1 helper account `nextWithdrawal`, and `apps/bridge-ui/machines/recovery.ts` classifies any recovered withdrawal with `finalised === true` as completed.
- Static trace: `packages/bridge-sdk/src/utils.ts` computes `withdrawalAux` from empty children, amount, and recipient only. It does not include transaction hash, nonce, or action state, so repeated same-recipient/same-amount withdrawals share the same aux.
- Static trace: `services/actions/api/src/schema/inner.ts` and `services/actions/api/src/schema/outer.ts` query action rows without filtering `markedAsCanonicalAt`, so API witness and commit queries can expose indexed-but-not-final rows.
- Live read-only evidence on 2026-06-17:
  - `https://testnet.indexer.actions.zeko.io/health` returned healthy, running, `inner.nonCanonicalTailCount=19`, `inner.lastFinalBlockHeight=1096642`, `inner.lastFinalIndex=10586`, `outer.nonCanonicalTailCount=57`.
  - `commitAsePastSlot(slot: 999999999)` from `https://testnet.api.actions.zeko.io/graphql` returned commit index `75726` at block `528479` and witness index `75727` at block `528541`, both in the current L1 non-final tail according to the health result and Mina archive `chainStatus=pending`.
  - `innerWitnessesFromAuxes` for aux `16385132513779525086752585207967168710839667157436946764012138256052728626960` returned many rows for the same aux, including index `10605` at block `1097368`, while health reported L2 final index `10586`.
- Conclusion: the observed UI false-completed state is explainable by API overexposure of non-final rows plus SDK/UI completion logic that treats helper-account advancement or same-aux historical matches as definitive completion.
