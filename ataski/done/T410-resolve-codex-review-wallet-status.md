---
id: T410
title: "Resolve Codex review wallet and status findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T16:06:00Z
updated_at: 2026-06-19T16:10:00Z
---

## Requirements

- Resolve the accepted Codex review finding that `create-wallet-env` writes wallet secret files with default OS permissions. Wallet files containing `MINA_PRIVATE_KEY` must be created with restrictive owner-only read/write permissions.
- Resolve the accepted Codex review finding that `fetchLastCommit` can miss a commit in the archive tip block because Mina archive action queries use an exclusive `to` block bound.
- Keep the fixes narrowly scoped to the wallet helper and bridge status helper behavior.
- Add focused tests proving wallet file permissions and inclusive tip-block coverage.

## Test Plan

- TDD: first add failing tests for the two review findings, then implement the smallest code changes needed to satisfy them.
- Run focused `bridge-cli` and `bridge-sdk` tests for the changed files.
- Rerun Codex review after the fixes.

## RED Evidence

- `codex-review --mode branch` reported `[P2] Protect generated wallet files from group/world reads` because `packages/bridge-cli/scripts/create-wallet-env.ts` used `open(filePath, "wx")`, allowing the process umask to create wallet files such as `0644`.
- `codex-review --mode branch` reported `[P2] Include the archive tip block when fetching commits` because `packages/bridge-sdk/src/status.ts` queried archive actions with `to: cursor`, while the Mina archive action query is treated elsewhere as an exclusive `to` bound.

## GREEN Evidence

- Added a `create-wallet-env` regression test proving generated wallet files are created with `0600` owner-only permissions.
- Added a bridge status regression test proving `fetchLastCommit` queries the archive with `to: pendingMaxBlockHeight + 1` so the pending tip block is included.
- Updated `create-wallet-env` to open new wallet files with explicit mode `0o600`.
- Updated `fetchLastCommit` to query inclusive block windows using the archive API's exclusive `to` bound and avoid overlapping windows.
- RED: `moon run bridge-cli:test -f -- tests/create-wallet-env.test.ts` failed because the generated wallet file mode was `0644` instead of `0600`.
- RED: `moon run bridge-sdk:test -f -- test/status.test.ts` failed because the first action query used `to: 100` instead of `to: 101`.
- GREEN: `moon run bridge-cli:test -f -- tests/create-wallet-env.test.ts && moon run bridge-sdk:test -f -- test/status.test.ts` passed.
- GREEN: `moon run bridge-cli:test -f && moon run bridge-sdk:test -f && moon run bridge-cli:typecheck -f && moon run bridge-sdk:typecheck -f && moon run bridge-cli:build -f && moon run bridge-sdk:build -f && moon run bridge-cli:lint -f && moon run bridge-sdk:lint -f && git diff --check` passed. `bridge-sdk:lint` still reports the pre-existing warning-level `noExplicitAny` warnings in `packages/bridge-sdk/src/types.ts`.
