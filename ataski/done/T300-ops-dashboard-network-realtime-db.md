---
id: T300
title: "ops-dashboard-network-realtime-db"
status: done
blockedBy: [T298]
owner: codex
created_at: 2026-06-10T12:33:58Z
updated_at: 2026-06-10T12:43:29Z
---

## Requirements

- Add a visible, ergonomic network selector so the same dashboard can switch between mainnet and testnet.
- Use network-specific default endpoints for actions indexer, L1 archive, L2 archive, L1 daemon, and L2 daemon, while preserving existing environment override support.
- Ensure status refreshes automatically in near real-time without requiring manual refresh. The UI should indicate refresh cadence and pause refreshes when the page is hidden.
- Include richer actions indexer database state than the first version: expose health database status, queue/fetch position fields, last processed action identifiers, and any database/indexer counters returned by the indexer status API.
- Keep controls scoped to the selected network and include the selected network in control requests.
- Validate with meaningful tests for network config selection and database detail flattening, plus Moon typecheck/test/lint/build.

## Test Plan

- TDD: first add tests for mainnet/testnet config selection, fallback behavior for invalid network values, and database detail extraction from nested indexer payloads.
- Implement the status/control API network parameter and UI selector after the tests define expected behavior.
- Confirm the local server serves the dashboard and returns status for both `network=mainnet` and `network=testnet`.

## RED Evidence

- Current dashboard status API has no `network` query parameter and always uses mainnet defaults.
- Current UI has no network selector and only refreshes every 15 seconds without exposing the cadence.
- Current indexer probe only exposes a small fixed subset of health/status fields and does not flatten nested database state.

## GREEN Evidence

- Added mainnet/testnet network selection to the dashboard UI and scoped status/control API calls to the selected network.
- Added network-specific endpoint defaults and environment overrides, including `MAINNET_*` and `TESTNET_*` endpoint vars plus network-specific indexer token support.
- Changed live refresh from a hidden 15-second poll to an explicit 5-second live refresh loop while the document is visible.
- Expanded actions indexer details with database status, latency, checked age, environment, canonical progress age, outer/inner final block heights, final indexes, and non-canonical tail counts.
- `moon run ops-dashboard:test` passed: 1 file, 5 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed.
- `curl -fsS http://localhost:3092/` returned `200 text/html`.
- `curl -fsS 'http://localhost:3092/api/ops/status?network=mainnet'` returned `network: mainnet`, summary `4 ok / 1 warn / 0 error`, and actions indexer database details including `databaseStatus: up`, `databaseLatencyMs`, `databaseAgeMs`, `outerLastFinalBlockHeight`, and `innerLastFinalBlockHeight`.
- `curl -fsS 'http://localhost:3092/api/ops/status?network=testnet'` returned `network: testnet`, live testnet endpoint configuration, and actions indexer database details. Testnet L1 archive currently reports error because `https://api.minascan.io/archive/devnet/v1/graphql` timed out even for a `__typename` probe, which is a real upstream status signal.
