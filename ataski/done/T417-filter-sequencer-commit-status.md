---
id: T417
title: "Filter sequencer commit status"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T21:47:07Z
updated_at: 2026-06-19T21:53:04Z
---

## Requirements

- Prevent bridge commit status diagnostics from reporting inner bridge withdrawals as sequencer commits.
- Keep the L1 bridge commit scan behavior unchanged for outer bridge commit actions.
- Ensure sequencer diagnostics only scan actions for the configured sequencer account, while still surfacing the L2 archive network state and inner bridge contract identifier.

## Test Plan

- TDD: first add a status unit test that builds a runtime with distinct `innerPk` and `sequencerPk`, then asserts `fetchBridgeCommitStatusSnapshot` asks the L2 archive for the sequencer public key. The RED expectation is that the pre-fix code queries `innerPk`, which can include withdrawal actions.

## RED Evidence

- `moon run bridge-sdk:test -f` failed as expected in `status.test.ts`: the bridge status snapshot queried L2 archive actions with `innerPk` (`B62qjDede...`) instead of `sequencerPk` (`B62qkekm...`).

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 15 test files, 71 tests. The status snapshot now queries L2 archive actions with `sequencerPk`.
