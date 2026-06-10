---
id: T301
title: "Resolve PR 198 conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T14:06:55Z
updated_at: 2026-06-10T14:12:47Z
---

## Requirements

- Merge latest `origin/main` into PR #198 branch `branch/endpoint-url-refresh`.
- Resolve conflicts without dropping the endpoint updates from T299 or the proxy alias fallback restore from T300.
- Update the PR body to use a Linear closing magic word (`Fixes WEB-473`) so Linear auto-closes after merge.
- Do not write Linear comments or update the Linear issue description.

## Test Plan

- DDD: record the dirty PR state, merge `origin/main`, inspect conflict markers, resolve conflicts, then run focused endpoint/config scans and relevant tests for touched files.

## RED Evidence

- `gh pr view 198 --json mergeStateStatus` reported `DIRTY`.

## GREEN Evidence

- Merged `origin/main` into `branch/endpoint-url-refresh`.
- Resolved the `ataski/tasks.md` conflict by preserving main's `T298` and renumbering this PR's tasks to `T299`, `T300`, and `T301`.
- `rg -n "<<<<<<<|=======|>>>>>>>" --glob '!packages/layer/app/components/Button.vue'` found no conflict markers.
- Endpoint/proxy scan confirmed the new gateway hosts remain in consumer config while legacy proxy alias fallbacks remain in the proxy workers.
- `moon run bridge-cli:test -f -- sdk-config.test.ts` passed.
- `moon run zeko-skills:test -f` passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-validator:test -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
