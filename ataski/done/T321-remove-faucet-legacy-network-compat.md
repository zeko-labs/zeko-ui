---
id: T321
title: "remove faucet legacy network compat"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T22:44:06Z
updated_at: 2026-06-12T23:01:01Z
---

## Requirements

- Remove faucet CLI backwards compatibility for old `zeko:*` and dashed Zeko network IDs.
- The faucet CLI should accept and use only the new canonical network IDs exposed by `@zeko/networks`, mapping them directly to current Lumina SDK keys only where Lumina still names endpoints differently.
- Delete unused compatibility imports and helper paths; resetting old faucet limits is acceptable.
- Keep the worker/UI network nomenclature unchanged.

## Test Plan

- TDD: add a focused faucet CLI source-boundary test that fails while `normalizeLegacyNetworkId` or legacy network strings remain in `apps/faucet/scripts/cli.ts`, then simplify the implementation.

## RED Evidence

- `pnpm exec moon run faucet:test -f -- --run test/cli-network-boundary.test.ts` failed because `apps/faucet/scripts/cli.ts` still imports and calls `normalizeLegacyNetworkId`.

## GREEN Evidence

- `pnpm exec moon run faucet:test -f -- --run test/cli-network-boundary.test.ts` passed.
- `pnpm exec moon run -f faucet:typecheck` passed as part of the full edited-surface typecheck sweep.
