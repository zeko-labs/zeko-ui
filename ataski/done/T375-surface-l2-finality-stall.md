---
id: T375
title: "Surface L2 finality stall on dashboard"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T11:16:46Z
updated_at: 2026-06-17T11:28:00Z
---

## Requirements

- Detect the live failure mode where L2 action rows are already indexed, the L2 archive reports the indexed action block range as canonical, but the actions DB still reports those rows as non-final.
- The dashboard must not describe that condition as ordinary "waiting finality".
- The L2 pending/finality card and summary state must become an error when `innerNonCanonicalTailCount > 0`, the latest indexed L2 action block is at or below the L2 archive canonical height, and the DB final L2 action block is behind the latest indexed L2 action block.
- The visible copy must explain that canonical archive actions are not finalized in the DB, including archive canonical height, DB final action block, and indexed action block context.
- L1 finality display must keep using the existing 290-block finality semantics.

## Test Plan

- TDD.
- RED: add an actions-dashboard unit test for an L2 `ChainInsight` matching the confirmed live state: non-final tail exists, latest indexed action block is canonical in the archive, and final action block is behind. The test must expect an error state and copy that does not say ordinary finality waiting.
- GREEN: implement the smallest dashboard insight/copy change that satisfies the new test while preserving existing L1 tail behavior.

## RED Evidence

- `moon run actions-dashboard:test -f` failed as expected after adding the regression test: `reports L2 canonical action finality stalls as dashboard errors` failed with `actionFinalityState is not a function`.

## GREEN Evidence

- `moon run actions-dashboard:test -f` passed: 30 tests passed, including `reports L2 canonical action finality stalls as dashboard errors`.
- `moon run actions-dashboard:typecheck -f` passed.
- `moon run actions-dashboard:lint -f` passed.
