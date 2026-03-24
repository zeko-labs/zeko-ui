---
id: T151
title: "Fix post-merge zeko-skills sync workflow"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:37:19Z
updated_at: 2026-03-24T15:39:10Z
---

## Requirements

- Investigate the failed `sync-zeko-skills` workflow run on `main` after PR #158 merged.
- Determine why `validate-public-install` cannot find `zeko-skills:validate-public-install`.
- Fix the workflow or project config so the post-merge sync pipeline can validate the public install and continue to ClawHub publish.
- Amend the existing feature-branch tip commit and force-push the branch, as requested by the user.

## Test Plan

- DDD. Reproduce the failing `moon run -f zeko-skills:validate-public-install` path locally in the feature worktree, fix the task/workflow mismatch, then rerun the affected Moon task(s).

## RED Evidence

- GitHub Actions run `23497383213` failed in `validate-public-install` with `No tasks found. Unable to execute action pipeline. For targets zeko-skills:validate-public-install.`

## GREEN Evidence

- `CI=1 moon run -f zeko-skills:validate-public-install`
- `CI=1 moon run -f zeko-skills:publish-clawhub` now runs through `check` and fails with `Missing CLAWHUB_TOKEN`, proving the CI task is no longer filtered out by Moon.
- `moon run -f zeko-skills:test`
- `packages/zeko-skills/moon.yml` now marks both `validate-public-install` and `publish-clawhub` with `options.runInCI: true`.
- `packages/zeko-skills/tests/validation-tooling.test.ts` now asserts the CI-only tasks explicitly carry `runInCI: true`, so the workflow cannot regress back to `No tasks found`.
