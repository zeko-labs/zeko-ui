---
id: T314
title: "own-wallet-sdk-and-auro-mainnet"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-12T11:12:15Z
updated_at: 2026-06-12T11:14:15Z
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

## GREEN Evidence
