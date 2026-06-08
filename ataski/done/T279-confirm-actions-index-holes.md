---
id: T279
title: "Confirm Actions index holes"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T16:52:07Z
updated_at: 2026-06-08T17:05:00Z
---

## Requirements

- Confirm, using read-only evidence only, whether the Actions API/indexer database has sparse `outer_actions.index` values.
- Record the observed dense-index invariants: row count must equal `max(index) - min(index) + 1`, and any linked adjacent action-state rows must also have adjacent numeric indexes.
- Inspect Northflank/indexer logs without deploying, resetting, or mutating live infrastructure.
- Keep any local filesystem paths out of committed notes.

## Test Plan

- DDD: This is an investigation task. Validate with read-only SQL/log commands and capture the command outcome as RED/GREEN evidence in this task.

## RED Evidence

- `pnpm --dir services/actions/indexer exec northflank ...` failed because the worktree has no installed `northflank` binary yet; no live logs were retrieved at this point.
- The shell environment exposes no `DATABASE_URL`, Actions DB URL, Northflank token, or Supabase connection variable, so direct read-only production/testnet SQL could not be rerun from this checkout.
- User-supplied read-only SQL evidence reports `outer_actions` count `74296`, min index `0`, max index `74299`, and missing indexes `72335`, `72336`, `72337`, `73471`; this violates `count == max(index) - min(index) + 1` by exactly four rows.

## GREEN Evidence

- Read-only Northflank logs for `actions-indexer-testnet-deployment` on 2026-06-08 show the live testnet indexer repeatedly comparing `dbActions=160`, `fetchedActions=160`, `lastFinalIndex=74139`, and `currentIndex=74299`, then skipping inserts because there are no new actions in that tail window.
- The same log window shows latest outer progress `index=74139`, `blockHeight=525962`, and fetched outer tail ending at block `526247`. This is consistent with the supplied DB finding that the table's numeric high-water mark is `74299` while earlier index holes already exist.
- No deploy, reset, rebuild, or live DB mutation was performed.
