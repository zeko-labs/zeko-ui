---
id: T253
title: "Actions API env and workflows"
status: done
blockedBy: [T252]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T11:25:00Z
---

## Requirements

- Split `services/actions/api/wrangler.jsonc` into top-level mainnet config and `env.testnet`.
- Top-level/mainnet route is `api.actions.zeko.io` with `vars.ENVIRONMENT = "mainnet"` and mainnet Hyperdrive binding IDs from reviewed provisioning output.
- `env.testnet` route is `testnet.api.actions.zeko.io` with `vars.ENVIRONMENT = "testnet"` and the current testnet Hyperdrive IDs.
- Define each environment's `HYPERDRIVE` and `HYPERDRIVE_NO_CACHE` bindings explicitly because Wrangler env bindings are non-inheritable.
- Add Actions API Moon tasks `deploy-testnet`, `deploy-mainnet`, `live-e2e-testnet`, and `live-e2e-mainnet`.
- Update migrations to use `ACTIONS_TESTNET_DATABASE_URL` and `ACTIONS_MAINNET_DATABASE_URL`.
- Add testnet Actions API deploy automation from `main` using `moon exec --ignore-ci-checks actions-api:deploy-testnet` and post-deploy `actions-api:live-e2e-testnet -f`.
- Mainnet Actions API deployment must remain inside the unified `mainnet` GitHub Actions workflow.
- Do not manually edit `services/actions/api/worker-configuration.d.ts`; update Wrangler config and run `moon run actions-api:type-cf`.
- Update the Implementation Review Log for any details not already specified.

## Test Plan

- TDD: first show the current Actions API config has only `api.actions.zeko.io`, the migration workflow uses `ACTIONS_DATABASE_URL`, and no deploy/live-e2e split tasks exist.
- GREEN validation:
  - `moon run actions-api:type-cf`
  - `moon run actions-api:test`
  - `moon run actions-api:typecheck`
  - `moon run actions-api:lint`
  - workflow syntax inspection for changed GitHub Actions files.

## RED Evidence

Recorded on 2026-05-21:

- `services/actions/api/wrangler.jsonc` has a single top-level `api.actions.zeko.io` route and no `env.testnet`.
- Current top-level Hyperdrive IDs are `33ea9e81023146799e5658aae00731fc` for `HYPERDRIVE_NO_CACHE` and `abf1ac369edf418ba9243099f96ead76` for `HYPERDRIVE`; these are the current testnet DB bindings.
- `services/actions/api/moon.yml` has `manual-e2e-live`, `deploy`, and `deploy-preview`, but no `deploy-testnet`, `deploy-mainnet`, `live-e2e-testnet`, or `live-e2e-mainnet` tasks.
- `.github/workflows/actions-migrations.yaml` defines `migrate-production` with `DATABASE_URL: ${{ secrets.ACTIONS_DATABASE_URL }}`.
- `ataski/tasks.md` shows `T252` done, so `T253` is unblocked.

## GREEN Evidence

Recorded on 2026-05-21:

- `moon run actions-api:type-cf` completed and regenerated `services/actions/api/worker-configuration.d.ts` with `ENVIRONMENT: "testnet" | "mainnet"` and `TestnetEnv`.
- `moon query tasks 'project = actions-api' | rg 'deploy(-testnet|-mainnet|-preview)?|live-e2e|manual-e2e'` showed `deploy-testnet`, `deploy-mainnet`, `live-e2e-testnet`, and `live-e2e-mainnet`.
- `moon run actions-api:typecheck` passed after preserving local test database support through a narrow local-env adapter.
- `moon run actions-api:test` passed 9 tests using `vitest.node.config.ts`.
- `moon run actions-api:lint` passed.
- `rg -n "ACTIONS_DATABASE_URL|ACTIONS_TESTNET_DATABASE_URL|deploy-testnet|deploy-mainnet|REVIEW_REQUIRED|testnet.api.actions" .github services/actions/api docs/BRIDGE_MAINNET_READINESS_PLAN.md` showed the new explicit testnet secret/task/domain references and review-required mainnet Hyperdrive placeholders.
- Post-deploy live e2e tasks were not run because this PR must not deploy before review.
