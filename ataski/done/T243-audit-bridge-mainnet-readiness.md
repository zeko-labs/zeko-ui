---
id: T243
title: "audit-bridge-mainnet-readiness"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-21T07:51:03Z
updated_at: 2026-05-21T07:59:11Z
---

## Requirements

- Audit bridge-sdk, bridge-sdk examples, bridge-cli, bridge-ui config references, and actions-api/actions-indexer configuration for `mina:mainnet <=> zeko:mainnet` readiness.
- Do not run live bridge commands, submit transactions, or perform any value-moving test.
- Treat Actions API/indexer readiness as part of bridge readiness because SDK/CLI status and witness paths depend on `actionsApi`.
- Identify whether mainnet routes can be enabled now or must remain disabled until a separate mainnet Actions API/indexer deployment/config exists.
- Record concrete file-level evidence for every blocker or readiness claim.

## Test Plan

- DDD. This is an audit task: inspect source/config/docs and record findings before implementation.
- No RED test is required for this task because it does not change source behavior.
- Completion evidence is a written audit summary in this task file and an explicit go/no-go recommendation for implementation.

## RED Evidence

## GREEN Evidence

Audit completed from dedicated task worktree `ataski/worktrees/T243-audit-bridge-mainnet-readiness` on branch `task/T243-audit-bridge-mainnet-readiness`.

Findings:

- Mainnet CLI routes are intentionally known but disabled in current `origin/main`: `packages/bridge-cli/src/core/routes.ts:30-44` sets both `mina:mainnet -> zeko:mainnet` and `zeko:mainnet -> mina:mainnet` to `enabled: false` with a generic not-enabled reason.
- `packages/bridge-cli/src/core/sdk-config.ts:17-24` contains mainnet L1/L2 endpoint constants, but line 22 maps mainnet `actionsApi` to the same `https://api.actions.zeko.io/graphql` endpoint as testnet (`packages/bridge-cli/src/core/sdk-config.ts:4-14`). There is no CLI override path for Actions API in this config factory.
- Bridge SDK depends on Actions API for status/witness/finalization paths, not just optional diagnostics:
  - `packages/bridge-sdk/src/index.ts:187-192` creates `actionsApiClient` during `Bridge.init`.
  - `packages/bridge-sdk/src/index.ts:808-844` uses Actions API for deposit witnesses, commit state, and indexed outer actions.
  - `packages/bridge-sdk/src/index.ts:1530-1588` uses Actions API for withdrawal witnesses, commit state, and indexed inner actions.
  - `packages/bridge-sdk/src/index.ts:1961-1978` uses Actions API for withdrawal status.
- Bridge UI explicitly documents the Actions API mainnet gap: `apps/bridge-ui/machines/helpers.ts:29-33` has `//TODO: Configure for mainnet` and points both mainnet and testnet to `https://api.actions.zeko.io/graphql`.
- Bridge UI is still mainnet-disabled at the UX gate: `apps/bridge-ui/app/components/Disabled.vue:13` treats any mainnet current network as wrong, `apps/bridge-ui/app/components/Disabled.vue:37-44` tells users the bridge is unavailable on mainnet, and `apps/bridge-ui/app/pages/index.vue:12-20` routes mainnet users to the disabled state.
- Actions Indexer configuration is testnet/alphanet-only in repo examples:
  - `services/actions/indexer/.env.example:4-9` uses Mina devnet archive, Zeko testnet archive, and testnet bridge contract public keys.
  - `services/actions/indexer/.env.alphanet:4-9` uses Mina devnet archive, Zeko alphanet archive, and alphanet keys.
  - `services/actions/indexer/README.md:47-52` lists a single production Northflank project/service (`actions-indexer`, `actions-indexer-deployment`) with no mainnet deployment documented.
- Actions API Cloudflare config exposes a single public route and Hyperdrive pair: `services/actions/api/wrangler.jsonc:23-35` uses `api.actions.zeko.io` and one database binding pair. No mainnet-specific API route, database, or environment split is present in repo config.
- Public docs also say mainnet CLI routes are not enabled: `https://docs.zeko.io/developers/tools/bridge-cli` lists only testnet routes as enabled and lists `mina:mainnet -> zeko:mainnet` / `zeko:mainnet -> mina:mainnet` under known but not enabled. The SDK docs at `https://docs.zeko.io/developers/tools/bridge-sdk` explicitly call out that withdrawal finalization depends on the L2 archive/indexer/actions-api path catching up.

Recommendation:

- Do not enable `mina:mainnet <=> zeko:mainnet` CLI routes in this pass.
- T244 should keep mainnet routes disabled but replace the generic disabled reason with an explicit Actions API/indexer readiness reason.
- T244 should still fix SDK/example configurability issues that do not imply route readiness, specifically configurable `l1Network`/`l2Network` in examples/manual read-only tests and the `Bridge.setL2()` archive endpoint bug if still present on `origin/main`.
- Mainnet route enablement should be a separate task after there is a documented/deployed mainnet Actions API/indexer path, including distinct endpoint/database/config evidence and non-value-moving health/readiness validation.
