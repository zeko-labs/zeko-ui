---
id: T152
title: "Split faucet fetch and rpc service bindings"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-26T11:42:31Z
updated_at: 2026-03-26T11:43:42Z
---

## Requirements

- Ensure `apps/faucet-ui` retains a default `FAUCET` service binding for `fetch()` calls used by `/api/healthcheck`.
- Add a dedicated RPC binding for `TurnstileClaimsEntrypoint` and use it only in `/api/faucet` internal turnstile claim flow.
- Keep existing healthcheck behavior unchanged.
- Regenerate Cloudflare worker types after wrangler binding updates.

## Test Plan

- Method: TDD (with scoped exception)
- Test Strategy Exception: Local unit tests for `faucet-ui` do not include a two-worker service-binding harness, so runtime behavior of Cloudflare service entrypoint dispatch cannot be represented with a meaningful automated RED test in this project.
- Pre-edit RED evidence: user-reported regression risk (healthcheck should remain default fetch) and current single-binding config coupling fetch+RPC concerns.
- GREEN validation: regenerate worker types and run lint/build for `faucet-ui`.

## RED Evidence

- Potential regression identified: healthcheck uses `env.FAUCET.fetch("https://faucet/healthcheck")` and must keep default service endpoint semantics.

## GREEN Evidence

- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:type-cf` passed and regenerated `apps/faucet-ui/worker-configuration.d.ts` with split bindings: `FAUCET: Fetcher` and `FAUCET_RPC: Service /* entrypoint TurnstileClaimsEntrypoint from faucet */`.
- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:lint` passed with no diagnostics.
- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:build` passed; Nuxt emitted non-blocking offline warnings about Google Fonts metadata fetch.
