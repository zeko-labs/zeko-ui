---
id: T314
title: "own-wallet-sdk-and-auro-mainnet"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T11:12:15Z
updated_at: 2026-06-12T11:36:29Z
---

## Requirements

- Add an internal `@zeko/sdk` package in this repository that owns the wallet machine and wallet event boundary currently imported by bridge UI from `@lumina-dex/sdk`.
- Update bridge UI to import wallet functionality from `@zeko/sdk` and remove its runtime dependency and Vite optimization config for `@lumina-dex/sdk`.
- Keep bridge UI internal network state on the new `@zeko/networks` nomenclature, while the wallet boundary maps to Auro network IDs such as `mina:devnet`, `mina:mainnet`, `zeko:testnet`, and `zeko:mainnet`.
- Support Auro wallet Zeko mainnet switching by using the Auro-recognized `zeko:mainnet` network ID and a real Zeko mainnet GraphQL URL for fallback `addChain` behavior.
- Use Auro terminology for wallet-facing network display names while retaining Zeko UI nomenclature for internal bridge route/config logic.
- Do not change the external Lumina repository; Lumina can import the new wallet package later.

## Test Plan

- TDD: add a bridge UI dependency/import test that fails while bridge UI imports `@lumina-dex/sdk`.
- TDD: add `@zeko/sdk` wallet tests that fail before the package exists and that assert Zeko-M mainnet maps to Auro `zeko:mainnet`, successful switching does not call `addChain`, and fallback `addChain` uses the real Zeko mainnet URL and Auro display name.
- GREEN requires the new SDK tests, bridge UI dependency test, bridge UI typecheck, and relevant bridge UI tests to pass.

## RED Evidence

- `pnpm install` was required in the task worktree after adding the `packages/sdk` test harness.
- `pnpm exec moon run sdk:test -f` failed as expected: `bridgeNetworkToAuroNetwork`, `AURO_NETWORKS`, and `switchAuroNetwork` were not implemented/exported from `@zeko/sdk`.
- `pnpm exec moon run bridge-ui:test -f -- --run test/unit/sdk-boundary.test.ts` failed as expected: bridge UI still contained `@lumina-dex/sdk` in its package/config/source boundary.
- Checked current Auro provider package metadata: `@aurowallet/mina-provider` latest npm package is `1.0.14`; the user's `2.5.1` mainnet support note appears to refer to Auro wallet app/extension behavior. The provider type still accepts a string `networkID`, so the code must pass Auro's `zeko:mainnet` string while keeping internal bridge IDs as `zeko-m:mainnet`.

## GREEN Evidence

- `pnpm exec moon run networks:test -f` passed.
- `pnpm exec moon run networks:typecheck -f` passed.
- `pnpm exec moon run sdk:test -f` passed.
- `pnpm exec moon run sdk:typecheck -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed: 19 files, 100 tests.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
- `pnpm exec moon run bridge-cli:typecheck -f` passed after adding the explicit Moon dependency on `networks`.
- `pnpm exec moon run bridge-validator:typecheck -f` passed after adding the explicit Moon dependency on `networks`.
- `pnpm exec moon run :format-all-fix -f`, `networks:lint-fix`, `sdk:lint-fix`, and `bridge-ui:lint-fix` passed.
- Pre-commit passed `:lint-fix`, `:format-all-fix`, and `bridge-ui:typecheck`; it reported only existing warnings in unrelated packages (`bridge-sdk`, leaderboard indexer/API tests).
