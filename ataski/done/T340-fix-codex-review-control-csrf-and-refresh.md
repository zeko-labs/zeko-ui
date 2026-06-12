---
id: T340
title: "Fix Codex review control CSRF and refresh"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T17:52:00Z
updated_at: 2026-06-12T17:55:00Z
---

## Requirements

- Reject cross-site or form-encoded requests to destructive action-indexer control endpoints.
- Force a fresh dashboard snapshot after Start, Stop, Rebuild, or Reset even when an auto-refresh is already in flight.
- Preserve same-origin dashboard controls, server-side token handling, and existing network validation.

## Test Plan

- BDD: add focused tests for the control request guard and the post-control refresh force option before implementing the fixes.
- RED path: prove form/cross-site control requests are currently accepted by helper-level behavior and post-control refresh currently calls the non-forced path.
- GREEN path: enforce same-origin JSON control requests, force post-control refresh, then rerun ops dashboard tests, typecheck, lint, build, diff check, and Codex review.

## RED Evidence

- `moon run -f ops-dashboard:test` failed before implementation because the new forced-refresh helper did not exist yet.

## GREEN Evidence

- Added a control request guard that requires JSON and rejects cross-site fetch metadata or origin mismatches.
- The control POST route applies the guard before reading the request body or dispatching indexer actions.
- The UI now forces the refresh after a successful control action so stale in-flight snapshots cannot win.
- `moon run -f ops-dashboard:test` passed: 27 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- `git diff origin/main --check` passed.
