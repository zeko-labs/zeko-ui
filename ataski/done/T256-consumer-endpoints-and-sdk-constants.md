---
id: T256
title: "Consumer endpoints and SDK constants"
status: done
blockedBy: [T253, T255]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T15:12:11Z
---

## Requirements

- Update all consumers so Actions API selection follows the L2 network.
- Testnet/alpha L2 must use `https://testnet.api.actions.zeko.io/graphql`.
- Mainnet L2 must use `https://api.actions.zeko.io/graphql`.
- Known files include `apps/bridge-ui/machines/helpers.ts`, `packages/bridge-cli/src/core/sdk-config.ts`, `packages/bridge-cli/tests/sdk-config.test.ts`, SDK examples/docs defaults, and Zeko skill endpoint references.
- Bridge UI should treat alpha as testnet in UI/domain copy or config.
- Bridge CLI mainnet routes can be enabled in this PR.
- Bridge CLI `doctor` should show route status, SDK endpoint mapping, Actions API URL, and backend health/readiness.
- Bridge SDK examples must support `L1_NETWORK` and `L2_NETWORK`, validate them as o1js `NetworkId` values, and default testnet examples to the testnet Actions API.
- `packages/bridge-sdk/test/live.manual.test.ts` must read network IDs from env.
- Bridge SDK core keeps `actionsApi` caller-provided.
- Mainnet has no v1 deposits, so mainnet `V2_DEPOSITS_START_INDEX` remains `0`.
- Mainnet `V2_WITHDRAWALS_START_INDEX` remains `0` unless a mainnet legacy history cutoff is introduced later.
- `BRIDGE_DEPLOY_BLOCK = 430_000` is testnet-specific and must become network-specific before mainnet routes are enabled.
- `SKIPPED_LEGACY_WITHDRAWAL_ACTION_INDEX = 3` is testnet-specific and must be network-guarded.
- Update the Implementation Review Log for any details not already specified.

## Test Plan

- TDD: first show current Bridge UI and CLI testnet config still use `https://api.actions.zeko.io/graphql`, SDK examples hardcode testnet network IDs, and SDK legacy constants are not fully network-guarded.
- GREEN validation:
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-cli:lint`
  - `moon run bridge-sdk:test`
  - `moon run bridge-sdk:typecheck`
  - `moon run bridge-sdk:lint`
  - `moon run bridge-ui:test-ci`
  - `moon run bridge-ui:typecheck`
  - `moon run bridge-ui:lint`

## RED Evidence

Recorded on 2026-05-21:

- `apps/bridge-ui/machines/helpers.ts` maps both `urls.actions.mainnet` and `urls.actions.testnet` to `https://api.actions.zeko.io/graphql`.
- `packages/bridge-cli/src/core/sdk-config.ts` maps testnet and mainnet SDK configs to `https://api.actions.zeko.io/graphql`, and `packages/bridge-cli/tests/sdk-config.test.ts` asserts the testnet value.
- `packages/bridge-cli/src/core/routes.ts` keeps Mina/Zeko mainnet routes disabled with `Known route, not enabled yet.`
- `packages/bridge-sdk/examples/helper.ts`, `packages/bridge-sdk/.env.example`, and `packages/bridge-sdk/test/live.manual.test.ts` default testnet examples/read-only tests to `https://api.actions.zeko.io/graphql` and hardcode `l1Network`/`l2Network` to `testnet`.
- `packages/bridge-sdk/src/utils.ts` exports a single `BRIDGE_DEPLOY_BLOCK = 430_000`; `packages/bridge-sdk/src/deposits.ts` uses it without checking network.
- `packages/bridge-sdk/src/withdrawals.ts` skips `SKIPPED_LEGACY_WITHDRAWAL_ACTION_INDEX = 3` without checking network.

## GREEN Evidence

Recorded on 2026-05-21:

- Bridge UI testnet Actions API config now uses `https://testnet.api.actions.zeko.io/graphql`; mainnet remains `https://api.actions.zeko.io/graphql`.
- Bridge CLI testnet SDK config now uses `https://testnet.api.actions.zeko.io/graphql`; Mina/Zeko mainnet routes are enabled and map to mainnet endpoints.
- `bridge doctor` now reports route status, SDK endpoint mapping, and Actions API health URLs for enabled routes.
- Bridge SDK examples and `.env.example` now accept `L1_NETWORK`/`L2_NETWORK`, validate supported bridge networks against o1js `NetworkId` typing, and default testnet examples to `https://testnet.api.actions.zeko.io/graphql`.
- `packages/bridge-sdk/test/live.manual.test.ts` now reads `BRIDGE_SDK_L1_NETWORK` and `BRIDGE_SDK_L2_NETWORK`.
- Bridge SDK deploy-block lookup is network-specific: testnet `430_000`, mainnet `0`.
- Legacy skipped withdrawal action index is guarded to testnet only.
- Zeko skill testnet endpoint references now use `https://testnet.api.actions.zeko.io/graphql` and include mainnet endpoint references separately.
- `moon run bridge-cli:test` passed 21 files / 105 tests, 13 skipped.
- `moon run bridge-cli:typecheck` passed.
- `moon run bridge-cli:lint` passed.
- `moon run bridge-sdk:test` passed 11 files / 47 tests.
- `moon run bridge-sdk:typecheck` passed.
- `moon run bridge-sdk:lint` completed successfully with the existing `src/types.ts` `noExplicitAny` warnings.
- `moon run bridge-ui:test-ci` passed 17 files / 95 tests.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:lint` passed.
