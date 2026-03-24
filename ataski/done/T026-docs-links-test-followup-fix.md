---
id: T026
title: "Docs links test follow-up fix"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T09:18:35Z
updated_at: 2026-02-27T09:23:20Z
---

## Scope

Reproduce the current docs links test failure locally, fix the regression, and
validate the docs test again.

## RED evidence

`CI=true moon run docs:test -f` -> fails because
`tests/check-links.test.ts` hits Vitest's default 5000ms timeout while running
the CI-only external link check.

## Changes

- Increased the CI-only docs links test timeout to 120 seconds so the external
  link scan can complete.
- Corrected the glossary Actions link to the current live o1js guide at
  `https://docs.o1labs.org/o1js/zkapps/actions-and-reducers`.

## GREEN evidence

`CI=true moon run docs:test -f` -> passes (`1 test`, `1 passed`).
