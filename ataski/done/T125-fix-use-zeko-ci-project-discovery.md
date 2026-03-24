---
id: T125
title: "Fix use-zeko CI project discovery"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:25:00Z
updated_at: 2026-03-24T01:55:00Z
---

## Requirements

- Investigate the currently failing PR #144 workflow where GitHub Actions reports `No tasks found` for `moon run -f use-zeko:check`.
- Reproduce the failure path in a fresh-checkout or cache-cold shape instead of relying on the local Moon cache.
- Fix the underlying cause so the use-zeko CI workflow resolves the intended target on GitHub Actions.
- Keep the fix minimal and consistent with the repo's Moon workspace conventions.

## Test Plan

- DDD. First reproduce the mismatch between local and CI project/task discovery, then apply the smallest fix and verify with the same discovery path plus the intended `moon run` command.

## RED Evidence

- GitHub Actions run `23469089826`, job `68287690005`, failed on `moon run -f use-zeko:check` with `No tasks found. Unable to execute action pipeline. For targets use-zeko:check.`
- `MOON_CACHE=.moon-ci-temp moon query projects | jq -r '.projects[] | select(.id=="use-zeko") | .tasks.check.options.runInCI, .tasks.build.options.runInCI, .tasks.test.options.runInCI, .tasks.validate.options.runInCI, .tasks.eval.options.runInCI'` returned `false true true false false`, confirming `check` existed but was excluded in CI.

## GREEN Evidence

- Added `options.runInCI: true` to `packages/use-zeko/moon.yml` for the `check` task.
- `MOON_CACHE=.moon-ci-temp moon query projects | jq -r '.projects[] | select(.id=="use-zeko") | .tasks.check.options.runInCI'` now returns `true`.
- `CI=1 MOON_CACHE=.moon-ci-temp moon run -f use-zeko:check`
- `moon run use-zeko:test -f`
