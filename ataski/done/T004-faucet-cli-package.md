---
id: T004
title: "Faucet CLI package"
status: done
blockedBy: [T002]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:44:09Z
---

Create the public `@zeko-labs/faucet-cli` package in `packages/faucet-cli`.

## TDD Exception

This task introduces a new CLI package and publish-ready scaffolding where the
repo does not yet have an existing CLI test harness to extend directly.
Validation will use package build and type-check commands plus command-level
smoke tests.

## GREEN Evidence

- `moon faucet-cli:build` passed
- `moon faucet-cli:lint` passed
- `moon faucet-cli:typecheck` passed
- `node packages/faucet-cli/bin/zeko-faucet.js whoami --json` exited `2` with `missing_token`
- `node packages/faucet-cli/bin/zeko-faucet.js claim bad-address --json` exited `4` with `invalid_address`
- PR `#120` merged into `epic/faucet-api-cli-refactor`: https://github.com/zeko-labs/zeko-ui/pull/120
