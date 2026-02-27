---
id: T002
title: "Faucet worker API refactor"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:09:31Z
---

## Scope

Refactor `apps/faucet/worker.ts` into the public faucet API and move abuse-prevention
logic into the worker.

## TDD Exception

This task changes a Cloudflare worker request pipeline, Wrangler bindings, and
external GitHub verification, but the repo does not currently have a focused
worker test harness for these end-to-end request paths. Validation will use
targeted worker type generation, relevant project checks, and manual request
verification against the worker contract.
