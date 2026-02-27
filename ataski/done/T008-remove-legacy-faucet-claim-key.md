---
id: T008
title: "Remove legacy faucet claim key"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T08:54:55Z
updated_at: 2026-02-27T09:00:02Z
---

Remove the temporary legacy bare-address faucet claim key path and verify the faucet TypeScript state after regenerating Wrangler types.

## RED Evidence

- `pnpm --filter faucet test -- --run test/worker.test.ts` failed
- `does not consult the removed legacy bare-address claim key` expected `202`, received `403`
- `stores GitHub claim markers in the shared claim namespace` expected `2` writes, received `3`

## GREEN Evidence

- `pnpm --filter faucet test -- --run test/worker.test.ts` passed (`3` files, `17` tests)
- `pnpm --filter faucet exec tsc --noEmit -p tsconfig.json` passed
- `pnpm --filter faucet exec tsc --noEmit -p test/tsconfig.json` passed
- `moon faucet:type-cf` passed and `apps/faucet/worker-configuration.d.ts` was already in sync
