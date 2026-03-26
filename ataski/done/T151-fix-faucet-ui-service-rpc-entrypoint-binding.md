---
id: T151
title: "Fix faucet-ui service RPC entrypoint binding"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-26T11:34:25Z
updated_at: 2026-03-26T11:38:48Z
---
## Requirements

- Fix the faucet submission path in `apps/faucet-ui/server/api/faucet.post.ts` so turnstile-verified requests can call the faucet worker RPC without throwing `TypeError: The RPC receiver does not implement the method "getEntrypoint"`.
- Ensure the faucet-ui Cloudflare binding configuration aligns with the RPC call shape used by the server handler.
- Do not change the faucet public `/claim` API behavior; only internal turnstile-to-faucet worker RPC wiring should change.
- Regenerate Cloudflare worker typings via the project task after binding changes.

## Test Plan

- Method: TDD (with scoped exception)
- Test Strategy Exception: This failure depends on Cloudflare service-binding RPC runtime behavior (`entrypoint` binding dispatch) that is not reproducible in the local unit-test harness available for `faucet-ui` in this repo. A meaningful local RED automated test would require a dedicated integration harness that runs two workers with real service bindings, which does not exist for this project.
- Pre-edit RED evidence will be captured as the observed runtime error from the failing path.
- GREEN validation will use type/lint checks and worker type generation to ensure the corrected binding and call shape compile and are consistent.

## RED Evidence

- Runtime failure observed in production path: `Error calling faucet RPC: TypeError: The RPC receiver does not implement the method "getEntrypoint"`.

## GREEN Evidence

- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:type-cf` passed and regenerated `apps/faucet-ui/worker-configuration.d.ts` with `FAUCET: Service /* entrypoint TurnstileClaimsEntrypoint from faucet */`.
- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:lint` passed with no diagnostics.
- `COREPACK_HOME=/tmp/corepack corepack pnpm exec moon run faucet-ui:build` passed; Nuxt emitted non-blocking warnings about fetching Google Fonts metadata in an offline environment.
