---
id: T329
title: "Resolve dashboard PR base drift"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-11T00:16:54Z
updated_at: 2026-06-11T00:28:42Z
---

## Requirements

- Merge the latest `origin/main` into the actions ops dashboard PR branch.
- Resolve any conflicts without dropping dashboard behavior, existing Ataski task history, or current `AGENTS.md` Linear guidance.
- Review the resulting diff for CI risks and unintended behavior changes.
- Run the dashboard validation tasks that cover tests, linting, typechecking, and build readiness.
- Push the branch after validation passes so GitHub can rerun CI on the updated base.

## Test Plan

- DDD: reproduce the base drift by confirming `origin/main` is not an ancestor of the PR branch, then merge latest main and inspect any conflicts.
- Validate with the project Moon tasks used by CI for `ops-dashboard`: test, typecheck, lint, and build.
- Check the PR status after push to confirm GitHub sees the branch as mergeable and CI checks are queued or passing.

## RED Evidence

- `git merge-base --is-ancestor origin/main HEAD` returned `1`, so the PR branch was behind current `origin/main`.
- GitHub PR state reported `mergeStateStatus: BEHIND`.

## GREEN Evidence

- `git merge origin/main` completed cleanly with no conflicted paths; the merge only brought in the latest `.github/workflows/bridge-mainnet-release.yaml` changes from main.
- `git diff --check` passed.
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" AGENTS.md apps/ops-dashboard ataski docs pnpm-lock.yaml .github/workflows` found no conflict markers.
- `moon run -f ops-dashboard:test` passed: 14 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed, with only existing dependency freshness warnings for browser compatibility data.
- `moon ci` passed locally and resolved the affected targets to `ops-dashboard:build`, `ops-dashboard:lint`, `ops-dashboard:typecheck`, `ops-dashboard:format`, and `ops-dashboard:test`.
