---
id: T097
title: "Commit and push bridge observability fixes"
status: in-progress
blockedBy:
  - T095
  - T096
owner: codex
created_at: 2026-03-12T16:56:14Z
updated_at: 2026-03-12T16:56:14Z
---

## Requirements

- Stage the current bridge observability follow-up changes without touching the unrelated `apps/bridge-ui/.sentryclirc` edit.
- Commit the changes with a Conventional Commit message and a confirmed Lefthook run.
- Push the updated `branch/bridge-observability-followup` branch to `origin`.

## Test Plan

- BDD.
- RED first: do not publish until the tracked follow-up fixes are staged cleanly and the unrelated `.sentryclirc` edit remains unstaged.
- GREEN second: create the commit with a successful hook run and push it to the existing review branch.

## RED Evidence

## GREEN Evidence
