---
id: T378
title: "Surface deposit finality risk"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T12:50:00Z
updated_at: 2026-06-17T12:58:00Z
---

## Requirements

- Surface L1/deposit finality risk in the actions dashboard when indexed L1 actions exist beyond the last final L1 action and the action coverage scan is otherwise current.
- Keep the existing L2 canonical finality stall behavior intact.
- Add an actions API compatibility probe that reports whether the deployed GraphQL schema exposes finality metadata (`markedAsCanonicalAt` and `finalityStatus`) for bridge actions.
- The dashboard must not present these states as fully OK; it should show an operator-visible warning/error message explaining what is stale or missing.
- Keep changes scoped to dashboard visibility and tests. Do not change bridge protocol finality rules in this task.

## Test Plan

- BDD. Add failing actions-dashboard tests that describe the operator-visible behavior:
  - L1 non-final action tails with current coverage are elevated from OK to warning.
  - L2 canonical finality stalls remain errors.
  - Actions API schema probes report missing finality metadata as a warning/error detail.

## RED Evidence

- `moon run actions-dashboard:test -f` failed as expected:
  - `probeActionsApi is not a function`, proving the dashboard lacks an actions API schema compatibility probe.
  - `reports L1 non-final action tails as deposit finality warnings` expected `warn` but received `ok`, proving L1/deposit finality risk is currently under-classified.

## GREEN Evidence

- `moon run actions-dashboard:test -f` passed: 33 tests.
- `moon run actions-dashboard:typecheck -f` passed.
- `moon run actions-dashboard:lint -f` passed.
- `git diff --check` passed.
- Local dashboard API at `http://127.0.0.1:3092/api/ops/status?network=testnet` now reports `actions-api` as `warn` with `Actions API schema is missing finality metadata`; the same snapshot still includes the raw L1 indexer details needed for the L1 deposit finality warning.
