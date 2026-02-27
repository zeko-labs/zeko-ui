---
id: T003
title: "Faucet UI turnstile adapter"
status: done
blockedBy: [T002]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:44:09Z
---

Adapt `apps/faucet-ui` to keep Turnstile verification only and forward requests
to the refactored faucet worker.

## TDD Exception

This task updates a Nuxt server route, shared response validation, and the page
state machine to match the new worker contract. The repo does not currently
contain a focused test harness for these coupled UI/server request paths, so
validation will use targeted type checking and manual request-flow checks.

## GREEN Evidence

- `moon faucet-ui:lint -u` passed
- `moon faucet-ui:build -u` passed
- PR `#121` merged into `epic/faucet-api-cli-refactor`: https://github.com/zeko-labs/zeko-ui/pull/121
