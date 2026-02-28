---
id: T010
title: "Investigate faucet moon typecheck"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-28T07:55:13Z
updated_at: 2026-02-28T07:56:02Z
---

Reproduce the faucet `moon typecheck` failure from the repo root, identify the actual failing path, and fix it without adding package-level workflow scripts.

## Findings

- No current `moon` failure was reproducible for the faucet project.
- `moon faucet:typecheck` passed from cache.
- `moon -u faucet:typecheck` passed after rerunning the task.

## Validation

- `moon faucet:typecheck` passed
- `moon -u faucet:typecheck` passed
