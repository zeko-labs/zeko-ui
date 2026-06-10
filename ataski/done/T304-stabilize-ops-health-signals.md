---
id: T304
title: "Stabilize ops health signals"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T13:42:00Z
updated_at: 2026-06-10T13:48:20Z
---

## Requirements

- Stop the header health pill from flipping between all-clear and attention based on intermittent auxiliary probe results.
- Keep action-indexer health prominent in the header, and surface archive/daemon probe issues separately.
- Investigate the live testnet L2 "txs since final action" value and determine whether it reflects expected finality/no-action behavior or a real action-indexer failure.
- Update dashboard wording if the current label incorrectly implies the action-indexer is behind when it is actually waiting for finality or there are no newer actions.

## Test Plan

- DDD: inspect live status and archive behavior first, then update focused dashboard utilities/tests and validate with Moon plus a browser-level local render check.

## RED Evidence

- The header currently derives its state from every service probe, so a transient L1 daemon timeout can flip the top bar between "All clear" and "attention" while the Zeko action-indexer is healthy.

## GREEN Evidence

- `moon run ops-dashboard:test` passed with 8 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed. Build emitted only existing Browserslist/baseline data age warnings.
- Browser-level Chrome DevTools Protocol check of `http://localhost:3092/?network=testnet` showed the header pill as "Indexer ok" and the L2 action stream as "2 pending actions".
- Live testnet status at 2026-06-10T13:42Z showed action-indexer `status=ok`, `databaseStatus=up`, `consecutiveErrors=0`, `lastFetchedInner=1094790`, `innerLastFinalBlockHeight=1080812`, and `innerNonCanonicalTailCount=2`.
- Direct L2 archive queries for `B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1` showed zero actions after block `1094790`, one action at block `1094790`, and two non-final actions since the last final block: `1094582` and `1094790`.
- The last final inner action timestamp is `2026-06-04T20:53:47.361Z`; the two non-final inner actions are `2026-06-10T01:54:02.934Z` and `2026-06-10T04:52:40.930Z`, both inside the configured 72h L2 finality window.
