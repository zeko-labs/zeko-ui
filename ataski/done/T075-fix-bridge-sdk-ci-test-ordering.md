---
id: T075
title: "Fix bridge-sdk CI test ordering"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:19:07Z
updated_at: 2026-03-11T17:20:35Z
---

## Requirements

- Ensure `bridge-sdk:test` cannot run before the GraphQL package build artifacts it depends on are available in CI.
- Keep the fix scoped to the bridge-sdk test task or related test configuration. Do not change bridge-sdk runtime behavior.
- Validate the fix in a clean enough local state to reproduce the missing-`dist` condition that caused the CI failure.

## Test Plan

- DDD
- Reproduce the CI precondition locally by removing `packages/graphql/dist`, then run `moon run bridge-sdk:test -f` and verify Moon schedules the required upstream build before Vitest starts.
- Record GREEN evidence with the exact command and result. No RED test is added because the failure is task ordering and environment-dependent rather than an assertion gap.

## RED Evidence

## Test Strategy Exception

The failure is caused by CI task scheduling against missing build artifacts, not by incorrect application behavior that can be captured with a stable new test assertion. This task will validate the dependency fix by recreating the missing-artifact condition locally and rerunning the affected Moon task.

## GREEN Evidence

- `tmp_dir="packages/graphql/dist.__ci_test_backup__"; mv packages/graphql/dist "$tmp_dir"; moon run bridge-sdk:test -f; exit_code=$?; find packages/graphql/dist -mindepth 1 -delete 2>/dev/null || true; rmdir packages/graphql/dist 2>/dev/null || true; mv "$tmp_dir" packages/graphql/dist; exit $exit_code`
  - Passed. `moon` scheduled `graphql:build` before `bridge-sdk:test`, and `bridge-sdk:test` then passed with 1 file and 4 tests in the missing-`dist` scenario that previously failed in CI.
