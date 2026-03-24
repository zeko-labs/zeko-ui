---
id: T135
title: "Merge main and move use-zeko workflow to Warp runners"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-24T12:09:05Z
updated_at: 2026-03-24T12:09:05Z
---

## Requirements

- Reproduce the current merge-conflict state for PR #144 against the latest `origin/main`.
- Merge `origin/main` into `branch/use-zeko-skill-public-mirror` and resolve every resulting conflict locally.
- Update `.github/workflows/use-zeko-skill.yaml` to use the repo-standard Warp runner instead of `ubuntu-latest`.
- Preserve the `use-zeko` package behavior and rerun the package verification after the merge and workflow update.

## Test Plan

- DDD. First reproduce the dirty merge state with a local merge against the latest `origin/main`, then resolve the conflicts, patch the workflow runner, and rerun the `use-zeko` package tests/checks from the repo root.

## RED Evidence

## GREEN Evidence
