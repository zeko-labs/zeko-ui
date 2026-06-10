---
id: T300
title: "Restore proxy alias fallbacks"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T13:18:46Z
updated_at: 2026-06-10T13:20:10Z
---

## Requirements

- Restore the Mina proxy Worker `backupUrls` aliases that were removed in T299.
- Keep the consumer-facing endpoint updates from T299 unchanged.
- Limit source edits to the four Mina proxy Worker files and required Ataski tracking.

## Test Plan

- DDD: first record that the four proxy Worker files lack their previous `backupUrls`, then restore the exact aliases and run a focused lint pass over those Worker files.

## RED Evidence

- `sed -n '1,80p' services/mina-proxy-devnet/worker.ts services/mina-proxy-mainnet/worker.ts services/mina-archive-proxy-devnet/worker.ts services/mina-archive-proxy-mainnet/worker.ts` showed each Worker passes only `primaryUrl` to `createProxyHandler`; the previous `backupUrls` aliases are missing.

## GREEN Evidence

- Restored `backupUrls` and the `backupUrls` parameter in:
  - `services/mina-proxy-devnet/worker.ts`
  - `services/mina-proxy-mainnet/worker.ts`
  - `services/mina-archive-proxy-devnet/worker.ts`
  - `services/mina-archive-proxy-mainnet/worker.ts`
- `pnpm exec biome lint services/mina-proxy-devnet/worker.ts services/mina-proxy-mainnet/worker.ts services/mina-archive-proxy-devnet/worker.ts services/mina-archive-proxy-mainnet/worker.ts` passed.
- `rg -n "gateway\\.mina\\.mainnet\\.zeko\\.io|gateway\\.mina\\.archive\\.mainnet\\.zeko\\.io" apps/bridge-ui/machines/helpers.ts packages/bridge-cli/src/core/sdk-config.ts packages/bridge-cli/tests/sdk-config.test.ts packages/bridge-sdk/examples/helper.ts packages/bridge-sdk/test/live.manual.test.ts packages/zeko-skills/zeko/references/40-endpoints-and-curl.md scripts/mainnet-readiness/plan-northflank-mainnet.nu docs/BRIDGE_MAINNET_READINESS_PLAN.md` confirmed the consumer-facing mainnet gateway endpoint updates remain in place.
