---
id: T093
title: "Finalize bridge-cli release and validator ops"
status: in-progress
blockedBy: [T092]
owner: codex
created_at: 2026-03-11T13:15:00Z
updated_at: 2026-03-12T14:40:00Z
---

Finalize the bridge-cli PR for review by validating the real high-level bridge flow locally, fixing any issues found, shifting release instructions to the Changesets flow, and adding a post-deploy script that pushes validator secrets from an `.env` file into Cloudflare.

Scope:

- run the manual local bridge validation in both supported directions using the root `.env`
- fix any runtime or validation issues uncovered by those live checks
- update operator docs so release is described through Changesets instead of ad-hoc workflow dispatch
- add a post-deploy secret sync script for `services/bridge-validator` that reads an `.env` file and pushes the supported secrets to Cloudflare with Wrangler
- add or update tests for the new script and documentation-adjacent helper logic where practical
- add a Changeset entry for the bridge-cli release prep work

## Follow-up Requirements

- merge `origin/main` into `canonical/bridge-cli` before continuing live validation
- the key CLI contract is unattended completion:
  - a user or agent runs a single bridge CLI command
  - the process may need to wait a very long time
  - when checked later, that same operation must have completed successfully without manual babysitting or intermediate resume steps
  - this must hold for both deposit and withdrawal flows
  - if meeting that contract requires first-class background-process handling in the CLI, implement it
- verify whether the withdrawal zero-witness stall is caused by the CLI or by backend data availability by checking the sequencer, archive node, and actions API directly
- only add a hard terminal failure for the withdrawal zero-witness path if the backend endpoints are healthy and the missing witnesses are a genuine terminal condition rather than an indexing/data-availability issue
- use the fresh wallet private key `EKFGXZoHswnSgGuBHAmhc3Gi5sAMFgL28hEdvS7FgoYuVeh1zaMr` for the new end-to-end live validation workflow
- achieve and record these live validation gates in order:
  - single fresh deposit end to end, unattended from one CLI invocation
  - single fresh withdrawal end to end, unattended from one CLI invocation
  - multiple queued deposits end to end
  - multiple queued withdrawals end to end
- handle the fresh-wallet first-withdrawal failure mode consistently in the SDK, CLI, and UI:
  - when the recipient has no L1 helper account and the withdrawal amount is below the L1 account creation fee, raise a clear protocol error instead of surfacing an opaque `rangeCheckN` failure
  - the CLI must show that message in both human and JSON output
  - the UI must stop endlessly retrying the pending-withdrawal poll on that terminal condition and show a user-friendly explanation
  - `operation resume` must re-run a previously failed operation instead of exiting immediately from persisted terminal state, so the resumed run can encounter the same protocol error and settle back into `failed`
- preserve the protocol cancel-first rule on deposit-side flows:
  - the CLI and UI must continue polling `canFinalizeDeposit` and `canCancelDeposit` together
  - if the current queued deposit is cancellable and not finalizable, they must submit `cancelDeposit` instead of drifting into a terminal failure path
  - this does not apply to withdrawals, which still have no protocol cancel path

## RED Plan

Start with failing or incomplete evidence for:

- local live bridge validation in both directions using the single `bridge` command
- absence of a supported post-deploy Cloudflare secret sync script
- release docs still pointing users at ad-hoc workflow dispatch rather than the Changesets release path

Validation will use:

- `moon run bridge-cli:live-bridge-mina-to-zeko`
- `moon run bridge-cli:live-bridge-zeko-to-mina`
- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run docs:build`

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-cli:live-bridge-mina-to-zeko`

Failures reproduced:

- the manual live-validation Moon task invoked Vitest through the default config, which excludes `tests/**/*.manual.test.ts`, so the task exited with `No test files found`
- after fixing the task path, the built CLI crashed under Node 24 with `ERR_AMBIGUOUS_MODULE_SYNTAX` because `o1js` had been bundled into the ESM output
- during resumed long-wait operation polling, the bridge SDK leaked `canCancelDeposit result:` debug output into stderr, making progress noisy
- later live validation against the real bridge exposed two more runtime gaps:
  - withdrawal submission polling could crash on `Field 'transactionStatus' is not defined on type 'query'`
  - resumed deposit tracking could stick to an older persisted target index instead of rebinding to the submitted hash for the current operation

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
- `moon run docs:build`

Real-network validation evidence:

- `bridge --from mina:testnet --to zeko:testnet --amount 1 --json` successfully submitted a live deposit with hash `5JtdoTmyLTSJ5v1na3YjjUzx5RPsQpM4MRSNU8VNfw4UFKHNQuW1`
- persisted operation `52387a62-e395-4a1b-87ea-4c22f9e191a0` resumed cleanly through `operation resume` after the harness fixes
- resumed progress showed only curated heartbeat lines after removing the SDK debug log leak

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-12:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- `moon run bridge-sdk:typecheck`

Follow-up fixes completed:

- restored the bridge SDK debug output behind a new `verbose` config/CLI flag instead of deleting it outright
- improved human CLI output readability with modest colors, icons, section headings, and clearer status/result formatting while keeping `--json` output unchanged
- hardened bridge polling against missing transaction-status queries, stale submitted-hash discovery, and stale prior-claim blocking with explicit terminal failures instead of indefinite hangs

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-12 with the root `.env` sourced from `/Users/hebilicious/GitHub/zeko-ui/.env`:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- `moon run bridge-sdk:typecheck`
- `node ./packages/bridge-cli/dist/cli.js operation resume 52387a62-e395-4a1b-87ea-4c22f9e191a0 --verbose`
- `node ./packages/bridge-cli/dist/cli.js bridge --from zeko:testnet --to mina:testnet --amount 1 --json`
- `node ./packages/bridge-cli/dist/cli.js operation resume d77943ed-7076-4ac6-88ae-c7dec36c613e --json`
- `node ./packages/bridge-cli/dist/cli.js deposit status --from mina:testnet --to zeko:testnet --account B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV --json`
- `node ./packages/bridge-cli/dist/cli.js withdrawal status --from zeko:testnet --to mina:testnet --account B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV --json`

Current live-network outcomes:

- Mina testnet -> Zeko testnet terminal failure confirmed for operation `52387a62-e395-4a1b-87ea-4c22f9e191a0` with submitted hash `5JtdoTmyLTSJ5v1na3YjjUzx5RPsQpM4MRSNU8VNfw4UFKHNQuW1`; `deposit status --json` still shows index `57117` as `confirmed: true` and `finalised: false`, and the resumed command now fails with `Bridge remained blocked by 1 earlier queued claim(s) before target index 57117 beyond the stale-prior-claim threshold.`
- Zeko testnet -> Mina testnet terminal failure re-confirmed for operation `d77943ed-7076-4ac6-88ae-c7dec36c613e` with submitted hash `5JuKAGhokmtQQYnJC7GRMQGS6x1NYVyKAwbX9KyeMSh3nLk8JK8w`; `withdrawal status --json` still returns `count: 0`, and the resumed command fails with `Submitted withdrawal transaction 5JuKAGhokmtQQYnJC7GRMQGS6x1NYVyKAwbX9KyeMSh3nLk8JK8w was not observed in bridge status before the stale-submission threshold elapsed.`
- An exploratory fresh withdrawal run also submitted hash `5JunRSCgsRGfzweUAsmiNXYZGUbHNoDirp2t9goK8qgMYryxLLJd` under operation `66775c3c-9b2a-4845-8f94-84e497cea644`, but it remained in `waiting-submission` while `withdrawal status --json` still reported no operations for the account, so the conclusive terminal check stayed on the older resumed operation rather than waiting another full stale-submission window.

Output-mode checks:

- human output from `operation resume ... --verbose` rendered the new labeled summary (`Bridge failed`, `Operation`, `Route`, `Phase`, `Recipient`, `Amount`, `Log`) without breaking progress logs
- `--json` output from `operation resume ... --json` preserved the expected structured contract with `success`, `operation_id`, `route`, `direction`, `status`, `submitted_transactions`, `final_transaction`, `explorer_urls`, and `log_path`
- the live runs without `--verbose` emitted only the curated progress lines; no bridge SDK debug output appeared unless the flag was set

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-12 after merging `origin/main`:

- `git fetch origin main`
- `git merge --no-edit origin/main`

Backend data verification for the stalled withdrawal queue:

- sequencer query at `https://testnet.zeko.io/graphql` returned `10` live withdrawal actions for account `B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV`
- the same wallet returned `0` actions from the L2 archive endpoint `https://archive.testnet.zeko.io/graphql`
- exact auxes derived from those `10` live withdrawal actions returned `0` rows from `innerWitnessesFromAuxes` on `https://api.actions.zeko.io/graphql`
- a direct `innerActions` range query over the live action-state span also returned `0` rows from `https://api.actions.zeko.io/graphql`

Current conclusion:

- the observed zero-witness withdrawal stall is consistent with backend indexing/data-availability lag across the L2 archive/actions API path, not with a purely local CLI interpretation error
- because the backend is not healthy on this path, the requested hard terminal failure for zero-witness withdrawals is not yet justified on the merged branch

Endpoint-level retry evidence captured on 2026-03-12:

- the transient `retrying phase=retrying operation=getWithdrawalStatuses • message=[Network] Bad Gateway` loop was reproduced directly against the sequencer endpoint `https://testnet.zeko.io/graphql`
- exact failing path is the SDK `fetchLiveActionsQuery` request used by `fetchRecentActions(this.l2Client, pk)` inside `fetchWithdrawalsWithStates`
- the same wallet check returned `HTTP 200` from:
  - `https://archive.testnet.zeko.io/graphql` on `FetchActions`
  - `https://api.actions.zeko.io/graphql` on both `FetchInnerWitnessesFromAuxes` and `FetchCommitAsePastSlot`
- current evidence therefore attributes the `Bad Gateway` retries to the L2 sequencer GraphQL endpoint, not the archive node or actions API

Docs follow-up completed on 2026-03-12:

- replaced the placeholder docs page at `apps/docs/content/users/guides/zeko-bridge.md`
- the page now links to:
  - Bridge UI at `https://bridge.zeko.io`
  - `/developers/tools/bridge-cli`
  - `/developers/tools/bridge-sdk`
- the page documents the bridge protocol at a high level, including:
  - submit-then-claim flow
  - deposit finalization vs cancellation behavior
  - withdrawal queue behavior
  - long waits caused by settlement, archive/indexer catch-up, and proof generation

Fresh-wallet live validation status on 2026-03-12:

- fresh wallet key `EKFGXZoHswnSgGuBHAmhc3Gi5sAMFgL28hEdvS7FgoYuVeh1zaMr` resolves to `B62qoVfH2wKqmePqMHoa8DLRvkrKWQGpWCgsqw4Vnc2fDNhXBqqv37Q`
- initial status checks returned `count: 0` for both:
  - `deposit status --from mina:testnet --to zeko:testnet`
  - `withdrawal status --from zeko:testnet --to mina:testnet`
- fresh single deposit command submitted hash `5JvN7coBrYuwToFit3TcVVHpHtyPd74z4LzCcoAvix1B4N5RLhUv` under operation `364e1bcf-2cc8-46ef-a2ac-0c3a91a61a19`
- the Mina node `bestChain` query shows that hash included at block `503353` with `failureReason: null`
- the Mina archive endpoint `https://gateway.mina.archive.devnet.zeko.io` still returns `0` actions for the fresh wallet over the recent `493353-503353` block window, so the CLI remains in `waiting-submission` with `No deposits found`
- the same fresh deposit later progressed unattended to `waiting-finalization`, became finalizable, and then completed successfully with finalize hash `5Jtr41h8wH5pK2VPwSveLEkwQ2x1zfNrMo68GVa7SFrxrJXXpotW`
- fresh withdrawal command `bridge --from zeko:testnet --to mina:testnet --amount 0.2 --json --verbose` submitted hash `5JukqDmxLQzad4oyMLN558X6a8FEtt1WUpffsGFKdNe5GcCYb9TZ` under operation `1163c98b-09aa-4af7-bf4f-9ececb9f2723`
- current withdrawal evidence:
  - live sequencer shows the withdrawal immediately
  - recent archive-node windows near tip still return `actions: []`
  - `withdrawal status --json` still reports `committed: false` and `finalised: false`
  - the unattended CLI loop remains alive and keeps retrying through transient gateway errors, but finalization is still blocked on `No withdrawal witnesses found`

Additional live failure analysis captured on 2026-03-12:

- once the sequencer recovered and the fresh withdrawal advanced from provisional index `-1` to claim index `0`, the operation failed terminally with:
  - `rangeCheckN: expected field to fit in 64 bits, got 28948022309329048855892746252171976963363056481941560715954676764349167630337.`
- direct bridge-sdk inspection confirmed:
  - the recipient `B62qoVfH2wKqmePqMHoa8DLRvkrKWQGpWCgsqw4Vnc2fDNhXBqqv37Q` does not yet have the L1 helper account
  - `l1AccountCreationFee = 1000000000`
  - withdrawal amount = `200000000`
- the current SDK finalize path subtracts the L1 account creation fee from the withdrawal amount when the helper account is absent, so this first-withdrawal-on-fresh-wallet case currently underflows and escapes as an opaque `UInt64`/`rangeCheckN` failure instead of a clear protocol error

First-withdrawal-too-small handling validated on 2026-03-12 after the SDK/CLI/UI fix set:

- `moon run bridge-sdk:test`
- `moon run bridge-sdk:typecheck`
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
- `node ./packages/bridge-cli/dist/cli.js operation resume 1163c98b-09aa-4af7-bf4f-9ececb9f2723 --json --verbose`

Validated behavior:

- the SDK now raises a clear protocol error before the previous `UInt64` underflow escapes:
  - `First Zeko->Mina withdrawal amount is too small: recipient B62qoVfH2wKqmePqMHoa8DLRvkrKWQGpWCgsqw4Vnc2fDNhXBqqv37Q does not have an L1 helper account yet, so the first withdrawal must be at least 1 MINA to cover the Mina account creation fee. This withdrawal is 0.2 MINA and cannot be finalized as submitted.`
- the CLI now surfaces that same message in both:
  - human/verbose output (`x failed ... message=...`)
  - structured JSON output via the new `error` field
- `operation resume` no longer exits immediately from the persisted `failed` state:
  - it restarted operation `1163c98b-09aa-4af7-bf4f-9ececb9f2723`
  - re-entered `waiting-finalization`
  - re-fetched the now-indexed withdrawal witness data
  - then failed again with the same explicit protocol error
- the UI now treats that condition as terminal instead of polling forever and maps it to a user-facing explanation about the first withdrawal needing at least 1 MINA when no Mina helper account exists yet
