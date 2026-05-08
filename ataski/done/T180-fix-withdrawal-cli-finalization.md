---
id: T180
title: "Fix withdrawal CLI finalization"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T00:46:08Z
updated_at: 2026-05-07T05:29:50Z
---

## Requirements

- Prove a real Zeko-to-Mina withdrawal through the single long-lived Bridge CLI `bridge` command on the alphanet-backed `zeko:testnet -> mina:testnet` route.
- The CLI must automatically advance earlier finalizable withdrawals instead of stopping on prior claims.
- Fix only the concrete SDK/CLI issue blocking the live withdrawal finalize path; keep the implementation aligned with `origin/pay-for-bridge` examples and avoid queue semantic rewrites.
- Preserve the existing deposit proof behavior.

## Test Plan

- BDD: first reproduce the user-visible CLI failure with a live withdrawal command and record the terminal failure.
- Then make the smallest source change needed to align the SDK withdrawal finalize path with the working branch.
- GREEN requires a fresh single-process CLI withdrawal run to finish with `success: true`, plus focused package validation.

## RED Evidence

- `HOME=/tmp/zeko-bridge-cli-home-pr167-withdrawal-proof BRIDGE_CLI_ACTIONS_API_URL=http://localhost:9100/graphql node packages/bridge-cli/dist/cli.js bridge --from zeko:testnet --to mina:testnet --amount 1 --json --verbose`
- The single live CLI process submitted withdrawal hash `5JuhU1SZdrAEpA5mJ4k7q1EnW5J2C31ijqyWAVWqX2qSgzHsn2Wu`, detected target index `7`, then correctly advanced prior claim index `2`, but finalization failed with a sequencer `rule_bridge_finalize_withdrawal.ml` constraint mismatch.

## GREEN Evidence

- SDK examples used the worktree wallet from `packages/bridge-cli/.env` (`MINA_PRIVATE_KEY="$WALLET_PRIVATE_KEY"`) and alphanet endpoints.
- `moon run bridge-sdk:canFinalizeWithdrawal -f` returned `available: true` at `2026-05-07T05:26:56Z` after the bridge withdrawal delay elapsed.
- `moon run bridge-sdk:fetchInnerActions -f` showed withdrawal index `12` with hash `5JuBNMm9Mv9DLaT6T6ZYvCUNf8Ti1YhExUznrspdBxSgWqxvm4EW`, amount `1300000000`, `committed: true`, and `finalised: true`.
- Live CLI withdrawal command completed successfully:
  - `HOME=/tmp/zeko-bridge-cli-home-pr167-withdrawal-valid-env-2 BRIDGE_CLI_ACTIONS_API_URL=http://localhost:9100/graphql node packages/bridge-cli/dist/cli.js bridge --from zeko:testnet --to mina:testnet --amount 1.3 --json --verbose`
  - submitted withdrawal hash `5JuBNMm9Mv9DLaT6T6ZYvCUNf8Ti1YhExUznrspdBxSgWqxvm4EW`
  - finalized hash `5JvJJJEFpHmDuiSefXzNAuZGxQPkD4rzSbX9UUKECQ8iLPWHPfXy`
  - completed event at `2026-05-07T05:27:30.638Z`
- Deposit behavior remains proven by the earlier live CLI deposit run using the same worktree env:
  - `HOME=/tmp/zeko-bridge-cli-home-pr167-deposit-fund-env-2 BRIDGE_CLI_ACTIONS_API_URL=http://localhost:9100/graphql node packages/bridge-cli/dist/cli.js bridge --from mina:testnet --to zeko:testnet --amount 1.6 --json --verbose`
  - submitted deposit hash `5JuvGMmDATp8skcVn7MhviuhgcD1u2UaDaF4qumBxsWLJmDsprfQ`
  - advanced prior deposit finalize hash `5Jv1HaYMF9yuZKG4JtGaJPLNzhHJ82s6p9SXKsyEx7AV6vj7fzEE`
  - finalized requested deposit hash `5JucVQZnsxTSHoEC8VTdyYXZUrRtodmVHNEY32AwQkCdoFhcKpSN`
- `moon run bridge-sdk:typecheck -f`
- `moon run bridge-sdk:test -f`
- `moon run bridge-cli:build -f`
- `moon run bridge-cli:typecheck -f`
- `cd packages/bridge-cli && pnpm exec vitest run tests/bridge-queue.test.ts --pool forks --maxWorkers=1`
