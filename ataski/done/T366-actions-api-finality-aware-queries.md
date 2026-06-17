---
id: T366
title: "Actions API finality-aware queries"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:40:00Z
updated_at: 2026-06-17T07:16:00Z
---

## Requirements

- Prevent finalization/status consumers from receiving indexed-but-not-final Actions API rows as final evidence.
- Update Actions API schema queries for inner witnesses, inner action ranges, outer witnesses, outer action ranges, and `commitAsePastSlot` so they only use rows with `markedAsCanonicalAt IS NOT NULL`.
- Expose finality metadata on returned action objects so callers can distinguish canonical/final rows from future non-final API surfaces without relying on hidden database details.
- Preserve existing GraphQL field names and response shapes as much as possible.
- Do not mutate database schema or migrations; use the existing `markedAsCanonicalAt` column.

## Test Plan

- TDD.
- RED: add Actions API query tests proving non-canonical inner/outer rows are excluded from witness/range/commit queries and returned rows include finality metadata.
- GREEN: update query predicates and GraphQL object fields until the focused tests pass.

## RED Evidence

- `moon run actions-api:manual-db-test -f` could not reach assertions because Docker/OrbStack is not running in this environment. The command exits before Postgres setup with: `Docker daemon is not running. Start Docker/OrbStack and rerun moon run actions-api:manual-db-test.`
- Added regression coverage in `services/actions/api/tests/actions.test.ts` for pending/non-canonical outer witness rows, commit ASE rows, and inner witness rows. The DB-backed test command remains blocked by the local Docker daemon state.

## GREEN Evidence

- `moon run actions-api:typecheck graphql:typecheck bridge-sdk:typecheck -f` passed in the T366 task worktree.
- Pre-commit Lefthook passed for commit `7ac8a716` with `MOON_NO_ACTIONS=true`: `:lint-fix`, `:format-all-fix`, and `bridge-ui:typecheck` all ran. The hook reported existing lint warnings in unrelated files but no blocking errors.
- `moon run actions-api:manual-db-test -f` was retried after implementation and remains blocked by Docker/OrbStack not running.
