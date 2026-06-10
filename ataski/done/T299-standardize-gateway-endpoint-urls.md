---
id: T299
title: "Standardize gateway endpoint URLs"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T12:54:05Z
updated_at: 2026-06-10T13:05:03Z
---

## Requirements

- Search the repository for stale Mina gateway and archive endpoint hostnames.
- Replace repository-owned endpoint references with the current hostnames:
  - `gateway.mina.archive.mainnet.zeko.io`
  - `gateway.mina.archive.devnet.zeko.io`
  - `gateway.mina.mainnet.zeko.io`
  - `gateway.mina.devnet.zeko.io`
- Keep unrelated URLs, generated artifacts, and intentional historical text unchanged unless they affect active configuration, examples, tests, or documentation users follow.
- Preserve existing project conventions and avoid adding new dependencies.

## Test Plan

- DDD: capture the stale endpoint inventory with `rg` before edits, update the relevant references, then run focused repository scans proving the old active hostnames are gone and the new hostnames are present where expected.
- Run any focused Moon validation task that applies to edited source/config packages after inspecting their `moon.yml`.

## RED Evidence

- `rg -n "api\\.minascan\\.io/(node|archive)|devnet-archive-node-api|mina(-archive)?\\.(devnet|mainnet)\\.zeko\\.io|archive\\.(testnet|mainnet)\\.zeko\\.io|https://(testnet|mainnet|devnet|alphanet)\\.zeko\\.io/graphql" --glob '!ataski/**' --glob '!pnpm-lock.yaml'` found active mainnet Mina consumer defaults still using `https://api.minascan.io/node/mainnet/v1/graphql` and `https://api.minascan.io/archive/mainnet/v1/graphql` in `apps/bridge-ui/machines/helpers.ts`, `packages/bridge-cli/src/core/sdk-config.ts`, `packages/bridge-sdk/examples/helper.ts`, `packages/bridge-sdk/test/live.manual.test.ts`, `packages/bridge-cli/tests/sdk-config.test.ts`, `packages/zeko-skills/zeko/references/40-endpoints-and-curl.md`, and `scripts/mainnet-readiness/plan-northflank-mainnet.nu`.
- The same scan found proxy Worker upstream/failover internals using external/legacy hosts in `services/mina-*-proxy-*/worker.ts`; these are not consumer endpoint defaults and must not be changed to the Worker's own public gateway URL without creating a recursive proxy path.

## GREEN Evidence

- Updated Bridge UI, Bridge CLI, Bridge SDK examples/manual live defaults, Zeko skill endpoint guidance, the mainnet-readiness script, and the readiness plan to use `https://gateway.mina.mainnet.zeko.io` and `https://gateway.mina.archive.mainnet.zeko.io` for mainnet Mina L1 consumer defaults.
- Removed legacy `https://mina*.devnet.zeko.io/graphql` and `https://mina*.mainnet.zeko.io/graphql` fallback URLs from the four Mina proxy Workers instead of replacing them with their own public `gateway.*` routes, which would create recursive proxy calls.
- Added `.changeset/fresh-gateways-walk.md` for the publishable Bridge CLI and Bridge SDK default/example changes.
- `rg -n "https://mina(-archive)?\\.(devnet|mainnet)\\.zeko\\.io" --glob '!ataski/**' --glob '!pnpm-lock.yaml'` returned no matches.
- `rg -n "https://api\\.minascan\\.io/archive/(devnet|mainnet)/v1/graphql" --glob '!ataski/**' --glob '!pnpm-lock.yaml'` returned no matches.
- `rg -n "https://api\\.minascan\\.io/node/(devnet|mainnet)/v1/graphql|https://devnet-archive-node-api\\.gcp\\.o1test\\.net|https://archive-node-api\\.gcp\\.o1test\\.net" --glob '!ataski/**' --glob '!pnpm-lock.yaml'` returned only the four Mina proxy Worker `primaryUrl` upstream origin targets.
- `moon run bridge-cli:test -f -- sdk-config.test.ts` passed.
- `moon run zeko-skills:test -f` passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `pnpm exec biome lint apps/bridge-ui/machines/helpers.ts packages/bridge-cli/src/core/sdk-config.ts packages/bridge-cli/tests/sdk-config.test.ts packages/bridge-sdk/examples/helper.ts packages/bridge-sdk/test/live.manual.test.ts services/mina-proxy-devnet/worker.ts services/mina-proxy-mainnet/worker.ts services/mina-archive-proxy-devnet/worker.ts services/mina-archive-proxy-mainnet/worker.ts` passed.
