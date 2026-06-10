---
id: T313
title: "Clarify action indexer health"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T13:19:45Z
updated_at: 2026-06-10T13:36:10Z
---

## Requirements

- Fix the ops dashboard health model so archive/indexer lag is based on action-indexer canonical final block height, not fetched action counts.
- Make copy consistently describe the single Zeko action-indexer and its L1 outer/L2 inner streams; do not imply a separate Mina indexer exists.
- Avoid showing an unavailable daemon block height for L2, because the L2 daemon does not expose blocks and one L2 block corresponds to one transaction.
- Keep the testnet/mainnet URL switch behavior intact and verify the testnet page loads.
- Surface the database and canonical progress details operators need to tell whether the action-indexer self-heal path is keeping up.

## Test Plan

- DDD: first inspect the existing action-indexer status semantics and live dashboard behavior, then update focused utility tests to pin the correct lag calculation and L2 daemon wording before validating the page and Moon tasks.

## RED Evidence

- Existing `buildChainInsight` compares `archiveHeight` to `lastFetchedOuter`/`lastFetchedInner`, but action-indexer modules return `lastFetchedBlock = actions.length`; this is an action count, not a chain block height.

## GREEN Evidence

- `moon run ops-dashboard:test` passed with 8 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed. Build emitted only existing Browserslist/baseline data age warnings.
- Browser-level Chrome DevTools Protocol check of `http://localhost:3092/?network=testnet` showed the page mounted with live testnet data, no runtime exceptions, and the updated L2 copy: "L2 exposes tx height through archive".
- Live investigation found the previous blank testnet page was caused by overlapping 5s refreshes superseding every status response while the testnet probe took roughly 5s. The page now skips overlapping automatic refreshes.
- Live testnet action-indexer status showed `databaseStatus=up`, `consecutiveErrors=0`, outer non-canonical tail within the 290-block L1 finality window, and inner non-canonical tail of 2. The visible L2 distance is a final-action/finality signal, not evidence that the self-heal path failed.
