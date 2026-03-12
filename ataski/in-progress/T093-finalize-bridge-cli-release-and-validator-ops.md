---
id: T093
title: "Finalize bridge-cli release and validator ops"
status: in-progress
blockedBy: [T092]
owner: codex
created_at: 2026-03-11T13:15:00Z
updated_at: 2026-03-11T18:02:41Z
---

Finalize the bridge-cli PR for review by validating the real high-level bridge flow locally, fixing any issues found, shifting release instructions to the Changesets flow, and adding a post-deploy script that pushes validator secrets from an `.env` file into Cloudflare.

Scope:

- run the manual local bridge validation in both supported directions using the root `.env`
- fix any runtime or validation issues uncovered by those live checks
- update operator docs so release is described through Changesets instead of ad-hoc workflow dispatch
- add a post-deploy secret sync script for `services/bridge-validator` that reads an `.env` file and pushes the supported secrets to Cloudflare with Wrangler
- add or update tests for the new script and documentation-adjacent helper logic where practical
- add a Changeset entry for the bridge-cli release prep work

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
