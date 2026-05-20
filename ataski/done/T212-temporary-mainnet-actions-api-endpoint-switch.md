---
id: T212
title: "Temporarily switch bridge-cli mainnet actionsApi endpoint"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T12:45:00Z
updated_at: 2026-05-19T13:06:00Z
---
## Requirements

- Apply a temporary source change in `packages/bridge-cli/src/core/sdk-config.ts` to replace the hardcoded mainnet `actionsApi` endpoint with the currently used local endpoint `http://127.0.0.1:9100/graphql`.
- Do not implement new configurability or broader refactors.
- Restart related local services (`actions-mainnet-pg` as needed, `actions-api`, `actions-indexer`) and verify they are healthy.
- Re-check the submitted deposit transaction progression after the temporary endpoint switch.

## Test Plan

- BDD
  - RED: run `bridge-cli deposit status` for mainnet before the change and capture the mismatch state.
  - GREEN: run the same status command after the change and confirm it reflects data from the local actions API, then verify transaction progression with bridge-sdk/indexer checks.

## RED Evidence

- Before the source change, mainnet deposit status resolved against the hardcoded remote actions API and returned no operations for the wallet despite local indexer data.
- Command:
  - `nix develop -c env MINA_PRIVATE_KEY=... node packages/bridge-cli/dist/cli.js deposit status --from mina:mainnet --to zeko:mainnet --json`
- Result before patch:
  - `count: 0`, `operations: []`.

## GREEN Evidence

- Patched `packages/bridge-cli/src/core/sdk-config.ts` mainnet `actionsApi` to `http://127.0.0.1:9100/graphql`.
- Rebuilt CLI:
  - `nix develop -c pnpm exec moon run bridge-cli:build -f`.
- Restarted related services and verified runtime health:
  - local Postgres container `actions-mainnet-pg` recreated on `5434`.
  - `actions-api` healthy at `http://127.0.0.1:9100/health`.
  - `actions-indexer` healthy at `http://127.0.0.1:3600/health` with `OUTER_PK=B62qry7rMxZmpDdjLA7EyxzrLHhgQ8s3jaPHD3fxhN5zTS5W7isyJbD`.
- After patch, mainnet deposit status now resolves through local actions API and returns the pending transaction:
  - Command:
    - `nix develop -c env MINA_PRIVATE_KEY=... node packages/bridge-cli/dist/cli.js deposit status --from mina:mainnet --to zeko:mainnet --json`
  - Result after patch:
    - `count: 1`
    - operation index `35`, hash `5JtaQ1kUqY8UezNSzzjsasdCzp78pjsUoY2KwWz6Lms8NoSqANrQ`
    - flags: `synced=false`, `accepted=false`, `confirmed=false`, `finalised=false`.
- Progress check after restart:
  - `bridge-sdk:canFinalizeDeposit` still returns `No finalizable deposit found`.
  - indexer sync remains healthy with no lag and tip advancement (`lastFetchedBlock 527986`, tip `527988`).
