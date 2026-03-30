---
id: T164
title: "Replace faucet-ui h3 casts with local adapter types"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T10:03:44Z
updated_at: 2026-03-30T10:07:24Z
---

## Requirements

- Remove the route-local `event.context.cloudflare` casts from `apps/faucet-ui`.
- Make `nuxi typecheck` see `event.context.cloudflare.env` as the generated Worker `Env`.
- Avoid patching installed packages in `node_modules`.
- Keep the solution minimal and localized to faucet-ui typing setup.

## Test Plan

- TDD exception: the current route-local casts already keep the program green.
- Verify by removing the casts and running:
  - `pnpm exec moon run faucet-ui:typecheck -f`
  - `pnpm exec moon run faucet-ui:build -f`
  - `pnpm exec moon run faucet-ui:test -f`

## RED Evidence

- Test strategy exception recorded before source edits. The current code compiles only because of the route-local casts; the goal is to replace that boundary with a proper local type source.

## GREEN Evidence

- Replaced the ad hoc `h3` augmentation file with a local `types/nitro-cloudflare-dev/index.d.ts`
  override that binds `PlatformProxy<Env>` to faucet-ui's generated Worker `Env`.
- Added `cloudflare-env.d.ts` so the local adapter override can reference the committed
  `worker-configuration.d.ts` without treating it as a type library entry.
- Removed the route-local casts from:
  - `apps/faucet-ui/server/api/faucet.post.ts`
  - `apps/faucet-ui/server/api/healthcheck.get.ts`
- `pnpm exec moon run faucet-ui:typecheck -f`
- `pnpm exec moon run faucet-ui:build -f`
- `pnpm exec moon run faucet-ui:test -f`
