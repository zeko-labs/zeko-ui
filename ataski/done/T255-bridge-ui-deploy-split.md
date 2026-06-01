---
id: T255
title: "Bridge UI deploy split"
status: done
blockedBy: [T252]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T15:04:14Z
---

## Requirements

- Split `apps/bridge-ui/wrangler.jsonc` routes so top-level/default is mainnet with only `bridge.zeko.io`.
- Add `env.testnet` with `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io`.
- Update `apps/bridge-ui/workers-build.jsonc` so default branch `main` deploys testnet only through `bridge-ui:deploy-testnet`; non-main branches continue preview behavior.
- Update `apps/bridge-ui/moon.yml` with `deploy-testnet`, `deploy-mainnet`, and `deploy-preview` tasks that invoke the Nushell deploy entrypoint through `proto run nu --`.
- Keep deploy tasks out of generic `moon ci`; workflows must use `moon exec --ignore-ci-checks`.
- Update the Implementation Review Log for any details not already specified.

## Test Plan

- TDD: first show Bridge UI top-level Wrangler routes include both `bridge.zeko.io` and `alpha.bridge.zeko.io`, and Cloudflare Build currently calls `bridge-ui:deploy` on `main`.
- GREEN validation:
  - `moon run bridge-ui:type-cf`
  - `moon run bridge-ui:test-ci`
  - `moon run bridge-ui:typecheck`
  - `moon run bridge-ui:lint`
  - dry-run/syntax checks for deploy targets without live deploys.

## RED Evidence

Recorded on 2026-05-21:

- `apps/bridge-ui/wrangler.jsonc` top-level routes include both `bridge.zeko.io` and `alpha.bridge.zeko.io`, so alpha is currently coupled to the default deploy target.
- `apps/bridge-ui/workers-build.jsonc` deploys `main` with `bridge-ui:deploy`; after T252 this aliases to the testnet deploy target but the reviewed config should be explicit.
- `apps/bridge-ui/moon.yml` already contains the T252 Nushell tasks, so this task only needs to validate and wire route/build-trigger split behavior.

## GREEN Evidence

Recorded on 2026-05-21:

- `apps/bridge-ui/wrangler.jsonc` now has top-level mainnet route `bridge.zeko.io` and `env.testnet` routes `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io`.
- `apps/bridge-ui/workers-build.jsonc` now deploys default branch with `moon exec --ignore-ci-checks bridge-ui:deploy-testnet`; non-main branches still use `bridge-ui:deploy-preview`.
- Nushell deploy script syntax loaded for `BRIDGE_UI_DEPLOY_TARGET=testnet`, `mainnet`, and `preview` without invoking build/deploy.
- `moon run bridge-ui:type-cf` passed and regenerated `apps/bridge-ui/worker-configuration.d.ts`.
- `moon run bridge-ui:test-ci` passed 17 files / 95 tests.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:lint` passed.
