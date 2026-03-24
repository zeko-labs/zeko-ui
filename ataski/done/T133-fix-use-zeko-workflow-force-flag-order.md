---
id: T133
title: "Fix use-zeko workflow force-flag order"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:40:49Z
updated_at: 2026-03-24T01:42:15Z
---

## Requirements

- Fix the failing `use-zeko` CI workflow on PR #144.
- Update the Moon invocation to use the force flag in the argument order that Moon 2.0.3 accepts in GitHub Actions.
- Verify locally with the same Moon version already installed in this repo worktree.

## Test Plan

- DDD. Reproduce the workflow command behavior locally, patch the workflow, then rerun the corrected command locally.

## RED Evidence

- `gh run view 23468822401 --job 68286867407 --log`
- failing CI log showed `moon run use-zeko:check -f` ending with `No tasks found. Unable to execute action pipeline.`
- local reproduction with `moon 2.0.3` confirmed the accepted form is `moon run -f use-zeko:check`

## GREEN Evidence

- `moon run -f use-zeko:check`
