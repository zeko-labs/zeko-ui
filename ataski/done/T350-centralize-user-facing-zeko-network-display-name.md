---
id: T350
title: "Centralize user-facing Zeko network display name"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:07:35Z
updated_at: 2026-06-17T05:20:00Z
---

## Requirements

- Keep internal Zeko-M network IDs and nomenclature unchanged.
- Add a single shared display-name boundary in the network package or SDK so user-facing UI can show "Zeko Mainnet" while internal names can remain "zeko-m:mainnet" / "Zeko-M Mainnet".
- Update the bridge UI to consume the shared display-name helper for visible network labels instead of hardcoding or reading internal labels directly.
- Preserve existing internal labels where they are used for wallet/network APIs, CLI, tests, and non-user-facing nomenclature.
- Acceptance criteria: bridge UI visible labels for the Zeko-M mainnet route render as "Zeko Mainnet"; wallet/Auro internal chain labels remain compatible with existing Auro network values.

## Test Plan

- TDD. First add or update unit tests in `packages/networks` and `apps/bridge-ui` that fail because user-facing display names currently expose "Zeko-M Mainnet".
- RED path: run the relevant Moon test tasks and capture the expected assertion failure.
- GREEN path: implement the helper and UI consumption, then rerun the same tests plus typecheck for impacted projects.

## RED Evidence

- `moon run networks:test -f` fails in `packages/networks/tests/nomenclature.test.ts`: `formatUserFacingNetworkLabel` is not a function.
- `moon run bridge-ui:test -f` fails importing `formatBridgeNetworkLabel` from `apps/bridge-ui/machines/networks.ts`.

## GREEN Evidence

- `moon run networks:test -f` passed: 1 test file, 10 tests.
- `moon run bridge-ui:test -f` passed: 21 test files, 105 tests.
- `moon run networks:typecheck -f` passed.
- `moon run networks:lint -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
