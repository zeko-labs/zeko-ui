---
id: T315
title: "ops-dashboard-url-layout-lag"
status: done
blockedBy: [T301]
owner: codex
created_at: 2026-06-10T12:57:47Z
updated_at: 2026-06-10T13:07:05Z
---

## Requirements

- Make the mainnet/testnet selection URL-based so manual refresh and shared links keep the selected network.
- Rework the dashboard layout so L1 archive and L1 daemon are aligned in one row, and L2 archive and L2 daemon are aligned in one row.
- Add a clear one-line explanation of `rebuild` versus `resync/reset` near the controls.
- Highlight the operationally relevant state: whether the indexer is indexing current archive blocks, the indexer lag against archive heights, and archive/daemon height gaps.
- Preserve 5-second live refresh and network-scoped control requests.

## Test Plan

- TDD: add utility tests for lag calculation and chain lane extraction from probe details.
- Validate with Moon test/typecheck/lint/build.
- Verify locally that `?network=testnet` persists through refresh, the switch updates the URL, and status APIs still return green authenticated indexer state for both networks.

## RED Evidence

- Current selector only mutates local component state and does not update/read the URL.
- Current service card grid separates archive and daemon cards, so L1/L2 pairs are not visually aligned.
- Current details show raw fields but do not compute indexer/archive lag or archive/daemon gaps.

## GREEN Evidence

- Added URL-backed network selection through the `network` query parameter. Initial loads normalize the query, switching networks updates the route, and refreshes/shared URLs preserve the selected network.
- Replaced the raw two-column service grid with an indexer panel plus L1 and L2 bands. Each band aligns archive and daemon cards side by side with a shared height strip.
- Added the control explanation line: rebuild repopulates indexed rows from archives and resumes from rebuilt heads; resync/reset clears indexed state and starts from scratch.
- Added `app/utils/ops-insights.ts` for signed lag/gap calculations and UI labels.
- Added highlighted operational cards for indexer/archive lag and archive/daemon gaps.
- Aligned the testnet L1 daemon default with the documented Zeko devnet proxy, `https://gateway.mina.devnet.zeko.io`.
- `moon run ops-dashboard:test` passed: 1 file, 7 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed.
- `curl -fsS 'http://localhost:3092/?network=testnet'` returned `200 text/html`.
- `curl -fsS 'http://localhost:3092/api/ops/status?network=mainnet'` returned `network: mainnet` with summary `5 ok / 0 warn / 0 error`.
- `curl -fsS 'http://localhost:3092/api/ops/status?network=testnet'` returned `network: testnet` with summary `5 ok / 0 warn / 0 error` and the expected Zeko devnet proxy endpoints.
