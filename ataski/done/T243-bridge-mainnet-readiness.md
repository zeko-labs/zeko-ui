---
id: T243
title: "bridge-mainnet-readiness"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-21T07:22:43Z
updated_at: 2026-05-21T07:35:48Z
---

## Requirements

- Audit bridge-sdk, bridge-sdk examples, and bridge-cli for mainnet readiness without running value-moving bridge transactions.
- Enable and validate configuration support for `mina:mainnet -> zeko:mainnet` and `zeko:mainnet -> mina:mainnet`.
- Keep testnet defaults intact for existing examples and CLI commands.
- Ensure configurable SDK/example network IDs are not hardcoded to testnet when mainnet endpoints are selected.
- Fix any discovered configuration bugs that would make mainnet endpoints partially ignored.
- Update public package docs and env examples where route/configuration support changes.
- Flag any remaining launch blockers or assumptions that still require operator confirmation.

## Test Plan

- TDD. First update focused unit tests to assert mainnet route support, mainnet SDK config mapping, environment-driven SDK example network IDs, manual live test network ID config, and correct L2 archive endpoint usage.
- RED should fail on the current implementation because mainnet routes are disabled, example/manual configs hardcode testnet IDs, and `Bridge.setL2()` passes `zekoUrl` as the archive endpoint.
- GREEN should run focused bridge-cli and bridge-sdk tests plus typechecks through Moon, without running manual live bridge tasks or any transaction that spends funds.

## RED Evidence

- `moon run bridge-cli:test bridge-sdk:test` failed after adding readiness tests:
  - `packages/bridge-cli/tests/routes.test.ts`: `mina:mainnet -> zeko:mainnet` and `zeko:mainnet -> mina:mainnet` are still disabled.
  - `packages/bridge-cli/tests/sdk-config.test.ts`: mainnet route config is rejected with `Known route, not enabled yet.`
  - `packages/bridge-sdk/test/config.test.ts`: example config still returns `l1Network: "testnet"` / `l2Network: "testnet"` with `L1_NETWORK=mainnet` and does not reject `L1_NETWORK=devnet`.
  - The first draft of the `setL2()` archive assertion hit an ESM spy limitation for `o1js.Mina.Network`; adjust the harness with a module mock before relying on that assertion.

## GREEN Evidence

- `moon run bridge-cli:test bridge-sdk:test` passed.
  - bridge-cli: 21 test files passed; 106 tests passed; 13 skipped.
  - bridge-sdk: 8 test files passed; 42 tests passed.
- `moon run bridge-cli:typecheck bridge-sdk:typecheck` passed.
- `moon run bridge-cli:lint bridge-sdk:lint` passed with existing bridge-sdk warnings in `src/types.ts` for `ExtractInput<T>` using `any`; no lint errors were reported.
- No manual live bridge command, mainnet bridge transaction, or other value-moving test was run.

## Remaining Launch Notes

- Public Zeko docs indexed on 2026-05-21 still describe Bridge CLI routes as testnet-only; the repo README and Zeko skill references are now updated, but the docs site will need regeneration/deployment.
- Mainnet endpoint constants were not exercised with live network requests in this task, per the no-real-testing constraint.
