---
id: T406
title: "CLI Actions API override and fresh-wallet validation"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T08:22:13Z
updated_at: 2026-06-19T11:12:46Z
---

## Requirements

- Fold the wallet environment/runbook changes from PR 221 into the active bridge-finality hotfix branch for PR 220.
- Close PR 221 after its changes are incorporated into PR 220.
- Add a Bridge CLI `--actions-api` option so live validation can point the CLI at a local Actions API without source edits.
- Ensure the debugging runbook requires creating a fresh timestamped wallet file with the wallet creation script, moving 3 MINA from the validator wallet to that fresh wallet, running the high-level `bridge` command with that wallet, and reporting the outcome.
- Ensure the debugging runbook and verbose CLI output include the latest L2/sequencer bridge commit timestamp so operators do not need a separate manual query for that state every run.
- Keep wallet files in root-level `.env.wallet.${name}` files using the standard wallet environment variable names.
- Create a minimal Linear issue for the `Account_app_state_precondition_unsatisfied` finalization failure observed during local deposit queue advancement.
- Confirm whether the six observed deposit finalizations advanced the queue successfully without failure.

## Test Plan

- BDD: add or update CLI tests that prove `--actions-api` overrides the configured route Actions API endpoint for the high-level bridge command or shared runtime config path.
- BDD: add SDK/CLI tests that prove the latest bridge commit snapshot identifies commit actions and the verbose high-level bridge command logs the sequencer latest commit timestamp.
- BDD: run the fresh-wallet validation flow against the local Actions API/indexer stack using the runbook: create fresh wallet, fund it with 3 MINA from validator, run high-level bridge with `--actions-api`, and report CLI outcome.

## RED Evidence

- `moon run bridge-cli:test -f -- tests/sdk-config.test.ts` failed before implementation because `createSdkConfig(resolveRoute("mina:testnet", "zeko-m:testnet"), { actionsApi: "http://127.0.0.1:9100/graphql" })` still returned `https://testnet.api.actions.zeko.io/graphql`.

## GREEN Evidence

- Folded PR 221 wallet/runbook changes into PR 220 and pushed `branch/bridge-finality-hotfix`.
- Closed PR 221 after folding its changes into PR 220.
- Added high-level Bridge CLI `--actions-api` propagation through command args, adapter factory, SDK config, and README/docs.
- Added SDK status helpers for latest L1/L2 bridge commits and exposed verbose CLI `bridge-status` context, including sequencer last commit timestamp.
- Extended verbose CLI `bridge-status` diagnostics with current slot, withdrawal delay, deposit commit past-slot threshold, latest L1 synchronized outer action length, and latest L1 commit slot range.
- Created Linear issue WEB-490 for `Account_app_state_precondition_unsatisfied`.
- Created fresh wallet file `.env.wallet.bridge-test-20260619T084026Z` with public key `B62qjgV2gvK7bGFqb5ZWxDCWiM4oU6yMkeqYjbfks22UVaiwHaaWdDY`; verified it is distinct from `.env.wallet.validator`.
- Funded fresh wallet from validator with 3 MINA on Mina testnet; funding transaction `5JvRTcgJFgk6GJ3GXQkS2spA9LHyFj9PZSWjFKGjGdebx4w5Hiyn`.
- Started local Actions API at `http://127.0.0.1:9100/graphql` and local actions indexer at `http://127.0.0.1:3600`.
- Started fresh-wallet high-level bridge validation with `--actions-api http://127.0.0.1:9100/graphql` at 2026-06-19T09:30:04Z; submit transaction succeeded with hash `5JuQFFxJWUW95sXsNU3C7GonUXUiTzuCEbJ4CW7jQcfnVuyCvX9L`; the same live command finalized target deposit index 75957 with hash `5JtyFVsrrdcKbJKT76BYPdNW7MdTtti9Zq6EbHQcSSf6RjxAHpuB` and completed at 2026-06-19T11:05:57Z.
- At 2026-06-19T10:42:32Z, local Actions API/indexer state showed `currentSlot=830134`, `withdrawalDelay=5`, `targetSlot=830129`; slot-eligible commit synchronized through 75952, while the confirming commit for deposit 75957 was visible in the ASE tail with `slotRangeUpper=830144`.
- At 2026-06-19T11:01:31Z, local Actions API/indexer state showed `currentSlot=830140`, `withdrawalDelay=5`, `targetSlot=830135`; slot-eligible commit synchronized through 75954, while the ASE tail already contained a later commit synchronized through 75961.
- Fresh-wallet bridge operation id `9521a7d3-42a9-4acc-8468-fd628a956606` completed successfully with submitted transactions `5JuQFFxJWUW95sXsNU3C7GonUXUiTzuCEbJ4CW7jQcfnVuyCvX9L` and `5JtyFVsrrdcKbJKT76BYPdNW7MdTtti9Zq6EbHQcSSf6RjxAHpuB`; no replacement command or sidecar status command drove the bridge.
- Confirmed six successful deposit finalization submissions from local validator-wallet runs advanced the finalization target indexes 75808, 75812, 75819, 75825, 75840, and 75843; this does not mean those runs had no failures because two earlier attempts hit `Account_app_state_precondition_unsatisfied` before retries advanced the queue.
- `moon run bridge-cli:test -f -- tests/sdk-config.test.ts tests/cli.test.ts` passed.
- `moon run bridge-sdk:test -f -- test/status.test.ts` passed all non-manual bridge-sdk tests: 15 files, 64 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-sdk:lint -f` exited 0 with pre-existing warnings in `packages/bridge-sdk/src/types.ts`.
- `moon run bridge-cli:test -f` passed: 23 files, 123 passed, 13 skipped.
- `moon run bridge-cli:build -f` passed.
- `git diff --check` passed.
