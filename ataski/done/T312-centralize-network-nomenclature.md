---
id: T312
title: "Centralize network nomenclature"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T09:59:03Z
updated_at: 2026-06-12T10:20:10Z
---

## Requirements

- Replace ad hoc network string logic with shared TypeScript constants, types, and lookup dictionaries.
- Use the colon-form Zeko nomenclature to align with existing chain notation: `zeko-m:local`, `zeko-m:testnet`, `zeko-m:alphanet`, `zeko-m:mainnet`, `zeko-e:testnet`, and `zeko-e:mainnet`.
- Create a shared helper package for network IDs, display labels, route keys, explorer URLs, and SDK/backend network config helpers that can be imported by Bridge UI and Bridge CLI. Import it from SDK only if SDK-owned code currently duplicates this nomenclature.
- Replace the current `friendlyNetwork` string logic with a typed dictionary. There is a finite network set, so avoid fallback display construction for known network IDs.
- Prefer template interpolation from constants for route keys and related composed strings instead of hardcoding repeated route literals.
- Improve Bridge UI `getBridgeConfig` so it returns mostly static route data with minimal branching logic while preserving the SDK mainnet requirement: Zeko-M mainnet must send `l2Network: { custom: "zeko-mainnet" }`.
- Preserve wallet compatibility at the Bridge UI boundary for existing wallet network event IDs (`zeko:testnet` and `zeko:mainnet`) while storing app route state with the new canonical Zeko-M IDs.
- Update tests, docs, changesets, and affected package metadata to match the finalized nomenclature.

## Test Plan

- TDD: first update focused tests to require colon-form Zeko-M/Zeko-E IDs, dictionary-backed labels, shared route constants, and the Bridge UI mainnet SDK custom network payload. Run the focused tests and record RED evidence before implementation.
- GREEN validation should include the focused tests plus affected project test/typecheck tasks through Moon from the repo root.

## RED Evidence

- `pnpm exec moon run bridge-ui:test -f -- --run test/unit/network-nomenclature.test.ts` failed after updating expectations to colon-form IDs. `supportedNetworks` still returned `zeko-m-devnet`/`zeko-m-mainnet`, and explorer lookup for `zeko-m:testnet` produced `undefined/tx/5Jhash`.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/routes.test.ts tests/sdk-config.test.ts` failed after updating route expectations to colon-form IDs. `resolveRoute` rejected `zeko-m:testnet`, `zeko-m:mainnet`, and `zeko-e:testnet` as unknown routes.

## GREEN Evidence

- `pnpm exec moon run networks:test -f` passed.
- `pnpm exec moon run networks:typecheck -f` passed.
- `pnpm exec moon run bridge-ui:test -f -- --run test/unit/network-nomenclature.test.ts` passed.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/routes.test.ts tests/sdk-config.test.ts` passed.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
- `pnpm exec moon run bridge-cli:typecheck -f` passed.
- `pnpm exec moon run bridge-validator:typecheck -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed.
- `pnpm exec moon run bridge-cli:test -f` passed.
- `pnpm exec moon run faucet:test -f` passed.
- `pnpm exec moon run bridge-validator:test -f` passed.
- `pnpm exec moon run faucet-ui:typecheck -f` passed.
- `pnpm exec moon run faucet-cli:check -f` passed.
- `pnpm exec moon run faucet-cli:test -f` passed.
- `pnpm exec moon run zeko-skills:test -f` passed.
- `pnpm exec moon run docs:test -f` passed.
- `pnpm exec moon run :format-all-fix -f`, `pnpm exec moon run networks:lint-fix -f`, `pnpm exec moon run bridge-cli:lint-fix -f`, and `pnpm exec moon run bridge-ui:lint-fix -f` passed.
- Commit hook ran `pnpm exec moon run :lint-fix`, `pnpm exec moon run :format-all-fix`, and `pnpm exec moon run bridge-ui:typecheck`. Lint reported existing unrelated warnings but completed successfully.
