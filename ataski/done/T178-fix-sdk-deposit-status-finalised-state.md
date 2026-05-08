---
id: T178
title: "Fix SDK deposit status finalised state"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T00:09:00Z
updated_at: 2026-05-07T00:31:55Z
---

## Requirements

- Fix `Bridge.fetchDepositsWithStates` so deposit `finalised` state is computed from the relevant outer action window rather than slicing by the absolute outer action index.
- Preserve the SDK finalization witness logic and avoid adding queue semantics to the CLI.
- Validate against the live alphanet deposit state that the already-finalized earlier deposit no longer blocks the CLI queue.
- Keep unrelated local UI helper edits out of this task.

## Test Plan

- BDD: add focused SDK or CLI coverage for a deposit queue where a prior deposit has advanced `prevNextDeposit` and must be reported terminal/finalised.
- Rebuild the CLI and rerun the live CLI deposit/resume flow against alphanet until it reaches a terminal successful result.

## RED Evidence

- Live CLI deposit submitted hash `5JuJxEo9pnepuYJaLPQrZ2myb443YzFjkQY6AyrCwm4ygRR8MnJ8` but stayed in `waiting-prior-claims`.
- `bridge-sdk:fetchOuterActions` showed prior deposit index `8951` with `finalised: false` while direct SDK context showed `prevNextDeposit: "8952"` and `isDepositFinalised(...) === true`.
- The state bug comes from `context.outerActions.slice(witness.index + 1)`, where `witness.index` is an absolute outer action index rather than the local array offset.

## GREEN Evidence

- `moon run bridge-sdk:test -f -- test/deposit-cancellation.test.ts` passed, including the regression where an absolute outer action index `8951` is finalised using local action position.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed (13 files, 61 tests), covering the bridge UI operation/view regressions against the rebuilt SDK.
- `moon run bridge-ui:typecheck -f` passed.
- `git diff --check` passed.
