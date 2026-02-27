---
id: T003
title: "Faucet UI turnstile adapter"
status: in-progress
blockedBy: [T002]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:28:35Z
---

Adapt `apps/faucet-ui` to keep Turnstile verification only and forward requests
to the refactored faucet worker.

## TDD Exception

This task updates a Nuxt server route, shared response validation, and the page
state machine to match the new worker contract. The repo does not currently
contain a focused test harness for these coupled UI/server request paths, so
validation will use targeted type checking and manual request-flow checks.
