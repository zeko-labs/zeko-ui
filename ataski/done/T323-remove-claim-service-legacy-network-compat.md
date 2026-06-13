---
id: T323
title: "remove claim service legacy network compat"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-13T05:14:57Z
updated_at: 2026-06-13T05:17:28Z
---

## Requirements

- Remove faucet claim-service compatibility for old `zeko:*`, dashed Zeko network IDs, and old address claim keys.
- Claim parsing should accept only the canonical faucet chain ID from `@zeko/networks`.
- Claim throttling should use only the current canonical address claim key; old claim limits may reset.
- Delete claim-service imports and helper code dedicated to legacy network alias normalization.

## Test Plan

- BDD: update faucet worker behavior tests so legacy chain IDs are rejected and legacy address claim keys no longer block canonical claims, then simplify the service implementation.

## RED Evidence

- `pnpm exec moon run faucet:test -f -- --run test/worker.test.ts` failed after updating the worker expectations: legacy chain IDs are still normalized, turnstile claims still read legacy `claim:zeko-testnet:*` keys, and existing legacy claim keys still block canonical claims.

## GREEN Evidence

- `pnpm exec moon run faucet:test -f -- --run test/worker.test.ts test/cli-network-boundary.test.ts` passed.
- `pnpm exec moon run -f faucet:typecheck` passed.
- `git diff --check` passed.
