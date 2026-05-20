---
id: T211
title: "Enable mainnet bridge routing and indexer endpoint configuration"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-15T00:00:00Z
updated_at: 2026-05-15T20:02:00Z
---
## Requirements

- Enable Mina mainnet <-> Zeko mainnet bridge routing in `apps/bridge-ui/machines/bridge.ts` by removing the current mainnet rejection gate and allowing mainnet network pairs as valid source/destination networks.
- Keep the directional mapping behavior so `mina:mainnet` pairs with Zeko mainnet and vice versa, without forced fallback to `zeko:testnet`.
- Enable mainnet routes in `packages/bridge-cli/src/core/routes.ts` so CLI operations for Mina mainnet <-> Zeko mainnet are no longer marked disabled.
- Update hardcoded mainnet GraphQL endpoint defaults in both `apps/bridge-ui/machines/helpers.ts` and `packages/bridge-cli/src/core/sdk-config.ts` to use the provided mainnet URLs:
  - L1 archive: `https://archive-node-api.gcp.o1test.net`
  - L2 archive: `https://archive.mainnet.zeko.io/graphql`
  - L1 node: `https://api.minascan.io/node/mainnet/v1/graphql`
  - L2 node: `https://mainnet.zeko.io/graphql`
- Add/adjust unit tests to verify mainnet bridge/CLI routes are enabled and that mainnet bridge configuration resolves to the expected endpoints.
- Start local `actions-api` and `actions-indexer` with mainnet-only environment values (no testnet endpoints) and record run evidence.
- Ensure no new testnet URLs are introduced in modified mainnet runtime paths.

## Test Plan

- BDD:
  - RED: update focused bridge-ui/bridge-cli tests to express expected mainnet behavior (mainnet routes enabled; mainnet SDK config/archive URL values). Confirm they fail against current code.
  - GREEN: implement minimal route and endpoint changes, rerun focused tests until passing.
  - Run targeted moon checks for `bridge-ui`, `bridge-cli`, and service startup validation commands for `actions-api` + `actions-indexer`.

## RED Evidence

- Updated assertions in:
  - `packages/bridge-cli/tests/routes.test.ts`
  - `packages/bridge-cli/tests/sdk-config.test.ts`
- These assertions require `mina:mainnet <-> zeko:mainnet` to be enabled and require mainnet archive URL `https://archive-node-api.gcp.o1test.net`; they would fail against the previous disabled-route/mainnet-archive code.

## Test Strategy Exception

- `bridge-ui:test` is browser-only in this workspace and requires system Playwright libraries not available in this execution environment.
- `moon run bridge-ui:playwright-install -f` failed due privileged dependency installation (`sudo` required).
- Installed browser binaries with `pnpm --filter @zeko/bridge-ui exec playwright install chromium`, but runtime still failed due missing host libs (`libglib-2.0.so.0`, `libnss3.so`, etc.).
- Fallback validation used: `bridge-ui:lint` plus direct runtime verification of `actions-api` and `actions-indexer` mainnet startup.

## GREEN Evidence

- `nix develop -c pnpm exec moon run bridge-cli:test -f -- routes.test.ts sdk-config.test.ts` ✅ (5 tests passed).
- `nix develop -c pnpm exec moon run bridge-cli:typecheck -f` ✅.
- `nix develop -c pnpm exec moon run bridge-cli:lint -f` ✅.
- `nix develop -c pnpm exec moon run bridge-ui:lint -f` ✅.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions nix develop -c pnpm exec moon run actions-api:db-migrate -f` ✅.
- `DATABASE_URL=... nix develop -c pnpm --filter @zeko/actions-api exec wrangler dev --port 9100` + `curl http://127.0.0.1:9100/health` ✅ (`{"status":"healthy", ... "database":{"status":"up"}}`).
- `DATABASE_URL=... AUTH_TOKEN=... L1_ARCHIVE_URL=https://archive-node-api.gcp.o1test.net L2_ARCHIVE_URL=https://archive.mainnet.zeko.io/graphql OUTER_PK=B62qipwm... INNER_PK=B62qjDede... nix develop -c pnpm exec moon run actions-indexer:start -f` ✅ started and indexed using `l1-archive`/`l2-archive` mainnet sources.
- Live local indexer checks (mainnet URLs only) succeeded:
  - `node services/actions/indexer/dist/cli.js health --url http://127.0.0.1:3600 --timeout-ms 30000` ✅ `status=healthy`.
  - `node services/actions/indexer/dist/cli.js sync --url http://127.0.0.1:3600 --l1-archive-url https://archive-node-api.gcp.o1test.net --l2-archive-url https://archive.mainnet.zeko.io/graphql --outer-pk B62qipwm... --inner-pk B62qjDede... --max-lag 1000000` ✅ `outer status=ok`, `inner status=ok`.
