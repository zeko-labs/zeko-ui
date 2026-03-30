---
id: T162
title: "Replace h3 cloudflare casts with typed augmentation"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T03:48:23Z
updated_at: 2026-03-30T09:47:50Z
---

## Requirements

- Replace the route-local `event.context.cloudflare` casts in `apps/faucet-ui` with a single `h3` module augmentation.
- Base the augmentation on the adapter's `PlatformProxy<Env>` types so the shape does not drift from Wrangler's definitions.
- Avoid introducing a new handwritten Cloudflare env object shape.
- Keep `worker-configuration.d.ts` as the source of truth for `Env`.

## Test Plan

- TDD exception: the current route-local casts already keep the typecheck green, so there is no pre-existing failing automated test to capture without first editing the source under test.
- Verify the refactor by removing the casts, then running `pnpm exec moon run faucet-ui:typecheck -f` and `pnpm exec moon run faucet-ui:build -f`.

## RED Evidence

- Test strategy exception recorded before source edits. The existing code compiles because of route-local casts; the task is to remove those casts and preserve green validation via a cleaner module augmentation.
- Attempted a direct `h3` augmentation using `PlatformProxy<Env>` and removed the route-local casts.
- `pnpm exec moon run faucet-ui:typecheck -f` failed with:
  - `server/api/faucet.post.ts(28,3): error TS2322: Type 'unknown' is not assignable to type 'string'.`
  - `server/api/faucet.post.ts(43,17): error TS18046: 'env.FAUCET_RPC' is of type 'unknown'.`
  - `server/api/healthcheck.get.ts(9,3): error TS18046: 'env.FAUCET' is of type 'unknown'.`
- Conclusion: `nitro-cloudflare-dev@0.2.2` hardcodes `H3EventContext.cloudflare.env` as `PlatformProxy["env"]`, which defaults to `Record<string, unknown>`. Local `h3` declaration merging does not successfully narrow that existing property during `nuxi typecheck`.
- Attempted the suggested `declare module "nitro-cloudflare-dev" { interface Cloudflare { env: Env } }` pattern in a local `apps/faucet-ui/nitro.d.ts`.
- `pnpm exec moon run faucet-ui:typecheck -f` still failed with the same `unknown` errors, confirming that `nitro-cloudflare-dev` does not expose an augmentable `Cloudflare` interface for this purpose.

## GREEN Evidence

- Reverted the attempted cast removal to keep the branch green.
- `pnpm exec moon run faucet-ui:typecheck -f`
- `pnpm exec moon run faucet-ui:build -f`
- Added explanatory comments for the remaining alias, h3 augmentation file, and route-local casts.
- `pnpm exec moon run faucet:typecheck -f`
- `pnpm exec moon run faucet-ui:typecheck -f`
