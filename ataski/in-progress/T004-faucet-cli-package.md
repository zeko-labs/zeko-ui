---
id: T004
title: "Faucet CLI package"
status: in-progress
blockedBy: [T002]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:28:35Z
---

Create the public `@zeko-labs/faucet-cli` package in `packages/faucet-cli`.

## TDD Exception

This task introduces a new CLI package and publish-ready scaffolding where the
repo does not yet have an existing CLI test harness to extend directly.
Validation will use package build and type-check commands plus command-level
smoke tests.
