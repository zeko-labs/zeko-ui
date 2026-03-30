---
id: T163
title: "Clarify faucet typing comments"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T09:59:51Z
updated_at: 2026-03-30T10:07:24Z
---

## Requirements

- Clarify why the faucet worker keeps the `FaucetWorkerEnv` alias instead of using generated ambient `Env`.
- Add the missing explanation to `env-compat.typecheck.ts`.
- Clarify the faucet-ui typing boundary and the adapter override that removes the route-local casts.

## Test Plan

- TDD exception: this is comment-only documentation work.
- Verify the comments do not break compilation with `pnpm exec moon run faucet:typecheck -f` and `pnpm exec moon run faucet-ui:typecheck -f`.

## RED Evidence

- Test strategy exception recorded before source edits. This task only clarifies existing typing boundaries and does not change runtime behavior.

## GREEN Evidence

- Added explicit comments to:
  - `apps/faucet/worker/types.ts`
  - `apps/faucet/worker/env-compat.typecheck.ts`
  - `apps/faucet-ui/types/nitro-cloudflare-dev/index.d.ts`
- `pnpm exec moon run faucet:typecheck -f`
- `pnpm exec moon run faucet-ui:typecheck -f`
