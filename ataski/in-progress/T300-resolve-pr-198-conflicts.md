---
id: T300
title: "Resolve PR 198 conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-10T14:06:55Z
updated_at: 2026-06-10T14:06:55Z
---

## Requirements

- Merge latest `origin/main` into PR #198 branch `branch/endpoint-url-refresh`.
- Resolve conflicts without dropping the endpoint updates from T298 or the proxy alias fallback restore from T299.
- Update the PR body to use a Linear closing magic word (`Fixes WEB-473`) so Linear auto-closes after merge.
- Do not write Linear comments or update the Linear issue description.

## Test Plan

- DDD: record the dirty PR state, merge `origin/main`, inspect conflict markers, resolve conflicts, then run focused endpoint/config scans and relevant tests for touched files.

## RED Evidence

- `gh pr view 198 --json mergeStateStatus` reported `DIRTY`.

## GREEN Evidence
