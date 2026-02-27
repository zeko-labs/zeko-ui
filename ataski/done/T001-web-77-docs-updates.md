---
id: T001
title: "WEB-77: docs link test gating and link fixups"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T08:40:51Z
updated_at: 2026-02-27T08:47:19Z
---

## Scope

Adjust the docs external link test so it only executes in CI, fix the test's
content path handling, and restore the Actions glossary link to an
actions-specific o1js page.

## TDD Exception

This change modifies an existing network-dependent test and a documentation
link target. Red-first TDD is not practical here because the intended behavior
change is to skip the outbound network checks outside CI. Validation will use a
targeted local test run to confirm the suite skips locally, plus direct file
inspection for the glossary link update.

## Changes

- Gate the outbound markdown link checks behind `process.env.CI` so local runs
  skip them.
- Convert `CONTENT_DIR` to `fileURLToPath(...)` for cross-platform filesystem
  path handling.
- Restore the Actions glossary link to the actions-specific o1js docs page.

## GREEN evidence

`moon docs:test` -> passes locally with `tests/check-links.test.ts` skipped
outside CI (`1 test`, `1 skipped`).
