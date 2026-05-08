---
id: T189
title: "Demote mocked bridge CLI tests"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T18:06:57Z
updated_at: 2026-05-08T18:08:10Z
---

## Requirements

- Rename the mocked `bridge-command` and `operation-command` CLI test files to the existing `.manual.test.ts` convention so Vitest excludes them.
- Replace their active contents with commented placeholders explaining that the old mocked suites were verbose, low-value, and should be refactored into actual live tests.
- Keep the useful fast CLI tests enabled.

## Test Plan

- DDD: verify the renamed files are excluded by the existing `tests/**/*.manual.test.ts` Vitest config.
- Run the bridge CLI test task to confirm the suite still passes without the demoted mocked files.

## RED Evidence

The previous full `bridge-cli:test` run only became usable after skipping many tests inside `bridge-command.test.ts`, `bridge-flow.test.ts`, and `operation-command.test.ts`. The user clarified that `bridge-command` and `operation-command` should be manual placeholders because their mocked coverage is too verbose and low-value.

## GREEN Evidence

- `moon run bridge-cli:typecheck bridge-cli:test`
- `git diff --check`
