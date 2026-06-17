---
id: T355
title: "Remove hardcoded Zeko Mainnet display copy"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:32:09Z
updated_at: 2026-06-17T05:40:15Z
---

## Requirements

- Do not hardcode the rendered display name `Zeko Mainnet` in bridge UI source or tests.
- The Ledger note must derive the user-facing network name from `formatBridgeNetworkLabel(ZEKO_M_NETWORKS.mainnet)` or the shared `@zeko/networks` helper boundary.
- Keep the single source of truth for rendered labels in `@zeko/networks` constants/helpers.
- Acceptance criteria: changing the shared helper/constant changes the Ledger note without editing `Inputs.vue`.

## Test Plan

- TDD. First update bridge UI tests to assert the Ledger note is assembled from `formatBridgeNetworkLabel(ZEKO_M_NETWORKS.mainnet)` and assert `Inputs.vue` does not contain the rendered `Zeko Mainnet` string.
- RED path: run `moon run bridge-ui:test -f` and capture the failure against the current hardcoded template text.
- GREEN path: derive the copy from the helper and rerun bridge UI tests/typecheck/lint.

## RED Evidence

- `moon run bridge-ui:test -f` failed `bridge-ui-copy.test.ts` because `Inputs.vue` still contained the rendered mainnet display string instead of `{{ ledgerUnsupportedNetworkLabel }}` from the helper.

## GREEN Evidence

- `rg -n "Zeko Mainnet" apps/bridge-ui docs/CODEBASE_MAP.md packages/networks/tests -S` returned no matches.
- `rg -n "Zeko Mainnet" packages/networks/src -S` finds only the shared `USER_FACING_NETWORK_LABELS` constants.
- `moon run bridge-ui:test -f` passed 22 files / 107 tests, including `bridge-ui-copy.test.ts`.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run networks:test -f` passed 1 file / 10 tests.
- `moon run networks:lint -f` passed.
- `moon run networks:typecheck -f` passed.
