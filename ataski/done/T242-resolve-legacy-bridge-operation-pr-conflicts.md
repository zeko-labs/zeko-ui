---
id: T242
title: "Resolve legacy bridge operation PR conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T12:11:41Z
updated_at: 2026-05-19T12:23:30Z
---

## Requirements

- Merge the latest `origin/main` into `branch/filter-legacy-bridge-operations`.
- Resolve conflicts without dropping the `bridgeVersion` SDK field or the bridge-ui filtering behavior from PR #176.
- Preserve the cancellation queue behavior already merged to `origin/main`.
- Validate the bridge SDK and bridge-ui paths after resolving conflicts, then push the updated PR branch.

## Test Plan

- TDD is not applicable because this is a merge-conflict reconciliation task; the branch already has behavior tests for `bridgeVersion` filtering.
- Test Strategy Exception: record the merge conflict files as RED evidence, then validate with focused bridge SDK and bridge-ui commands after resolution.

## RED Evidence

- `git merge origin/main` reported a content conflict in `ataski/tasks.md`.
- `apps/bridge-ui/machines/operations.worker.ts` auto-merged; review confirmed it preserved `bridgeVersion` filtering and the cancellation queue metadata/current-slot fields from `origin/main`.
- Ataski IDs from PR #176 overlapped with the newer mainline `T211`-`T240` range, so the PR task records were renumbered to `T241` and `T242`.

## GREEN Evidence

- `moon run bridge-sdk:test -f -- test/utils.test.ts` passed: 7 files, 39 tests.
- `moon run bridge-ui:test -f` passed: 17 files, 95 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
