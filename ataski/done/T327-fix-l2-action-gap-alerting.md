---
id: T327
title: "Fix L2 action gap alerting"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T19:21:04Z
updated_at: 2026-06-10T19:26:54Z
---

## Requirements

- Stop reporting L2 archive-head distance from the latest indexed action block as an error or warning when the coverage probe found no missing archive actions.
- Keep true missing action coverage as an error.
- Keep unknown or incomplete coverage as review-worthy, but label it as scan state rather than indexer data loss.
- Make the dashboard language explain that L2 archive head can advance with transactions that do not contain Zeko action-indexer actions.
- Ensure summary counters and the top header use the corrected states so they do not produce false positives.

## Test Plan

- DDD: add focused unit coverage for the state/label helpers that classify L2 action-free archive head distance as OK, then update the dashboard helpers and verify with the ops dashboard test/typecheck/lint suite.

## RED Evidence

- Current `coverageState` maps `actionCoverageStatus === "partial"` to `warn` for both L1 and L2.
- Current `coverageLabel` reports a positive L2 archive-head/action-block gap as `indexer behind archive head`, even when `missingActionCount` is `0`.
- Northflank logs and direct archive query showed testnet L2 scanned to archive head and found no actions after block `1,095,349`, so this is not missing indexed data.

## GREEN Evidence

- Replaced browser-only height-derived coverage with a private `/api/ops/action-coverage` scan that checks archive action rows for the configured action public keys.
- Updated browser hydration to use scanned coverage and fall back to existing server snapshot coverage if the scan endpoint is unavailable.
- Changed L2 clean-scan wording to `no missing L2 actions found` when archive head has advanced but no newer L2 action rows exist.
- Updated header state logic so unknown coverage does not force `Indexer needs review`; only explicit warning/error coverage does.
- Added a regression test for L2 archive head distance with zero newer action rows returning `current`.
- `moon run ops-dashboard:test` passed with 14 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:deploy` passed and deployed Worker version `c0c0c20b-9ae5-4a84-8110-e5e347ee723c`.
- Live production validation passed behind a temporary Cloudflare Access IP bypass: testnet action-indexer health returned HTTP 200 with L2 latest indexed action block `1,095,349`; `/api/ops/action-coverage` scanned `1,095,350-1,095,401`, returned `l2.actionCoverageStatus=current`, and `l2.missingActionCount=0`.
