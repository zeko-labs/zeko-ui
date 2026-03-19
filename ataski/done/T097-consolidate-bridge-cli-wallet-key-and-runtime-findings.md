---
id: T097
title: "Consolidate bridge-cli wallet key handling and resolve runtime review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T08:32:43Z
updated_at: 2026-03-19T08:46:40Z
---

## Requirements

- replace the multiple bridge CLI signer env vars with a single `ZEKO_BRIDGE_WALLET_PRIVATE_KEY` contract wherever the bridge CLI currently derives Mina and Zeko keys by default
- update bridge-cli runtime code, docs, and examples to use the consolidated wallet key naming
- validate the outstanding review findings against the current branch state and fix the real runtime issues only
- specifically address:
  - `operation resume-user` using one derived account for both directions when discovering pending work
  - duplicate pending deposit cancel submissions across polling cycles
  - stuck bridge sessions after a dropped finalize transaction
- if any reviewed finding is not actually valid after deeper inspection, document that in the task evidence instead of forcing a code change
- preserve the existing bridge-cli command surface unless a change is required to make the above behavior correct

## Test Plan

- Strategy: BDD
- add or extend focused CLI/runtime tests that fail first for:
  - wallet key consolidation and default account derivation
  - `resume-user` discovering both directions correctly
  - avoiding duplicate cancel submissions while a cancel is already pending
  - retrying or recovering when finalize submissions do not clear the claimable index
- then run the targeted bridge-cli test suite and typecheck/build tasks from Moon

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-19:

- `moon run bridge-cli:test`

Failures reproduced:

- `tests/signer.test.ts` still expects `ZEKO_BRIDGE_MINA_PRIVATE_KEY`, so the new shared-wallet contract fails immediately with `Missing required signer private key: ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- `tests/bridge-command.test.ts` still derives defaults from the old Mina/Zeko split env vars, so the command tests fail on the same missing-env error
- the newly added bridge-flow regression coverage exposes current runtime gaps:
  - one case resubmits the same prior cancellation while the first cancel is still pending
  - one case can wedge indefinitely after a finalize submission because the session never retries the same claimable index once `pendingFinalizeIndex` is set

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-19:

- `pnpm --dir packages/bridge-cli exec vitest run tests/bridge-flow.test.ts --config vitest.config.ts --testNamePattern 'does not resubmit the same prior cancellation'`
- `pnpm --dir packages/bridge-cli exec vitest run tests/bridge-flow.test.ts --config vitest.config.ts --testNamePattern 'retries a stale finalize submission'`
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`

Confirmed outcomes:

- bridge-cli now derives Mina and Zeko defaults from a single shared env var: `ZEKO_BRIDGE_WALLET_PRIVATE_KEY`
- the old split-key `resume-user` review finding is no longer applicable because default discovery no longer derives opposite directions from different signer env vars
- deposit queue polling no longer resubmits the same prior cancel while an identical cancel is already in flight
- stale finalize submissions now become retryable after the retry window instead of wedging forever on `pendingFinalizeIndex`
