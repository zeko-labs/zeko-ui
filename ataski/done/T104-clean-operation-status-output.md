---
id: T104
title: "Clean operation status output"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T18:55:00Z
updated_at: 2026-03-19T19:01:00Z
---

## Requirements

- Suppress the noisy dotenv banner during normal bridge-cli usage.
- Make `operation status` print a single fresh live status report instead of raw persisted session internals plus a nested live snapshot.
- Ensure the printed top-level phase/status fields reflect the current refreshed observation, including when an operation is ready to finalize or cancel.

## Test Plan

- DDD.
- RED path:
  - inspect the current `operation status` JSON output shape
  - confirm it prints raw session fields plus nested `liveSnapshot`
  - confirm dotenv can emit a banner during CLI startup
- GREEN path:
  - add/update targeted `operation-command` tests for the new fresh status shape
  - rerun `pnpm --dir packages/bridge-cli exec vitest run tests/operation-command.test.ts --config vitest.config.ts`
  - rerun `moon run bridge-cli:test`

## RED Evidence

- `operation status` currently prints `JSON.stringify(refreshedSession)`, which exposes stale persisted fields alongside the nested `liveSnapshot`.
- `dotenv` is configured without `quiet: true`, so the package may emit a startup banner before CLI JSON output.

## GREEN Evidence

- Added a dedicated operation-status serializer so `operation status` emits one fresh SDK-backed report instead of the raw persisted session object with a nested `liveSnapshot`.
- Enabled quiet dotenv loading to suppress the startup banner during normal CLI JSON output.
- `pnpm --dir packages/bridge-cli exec vitest run tests/operation-command.test.ts --config vitest.config.ts`
- `moon run bridge-cli:test`
- `node /Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli/packages/bridge-cli/dist/cli.js operation status 7181a261-6753-4ea3-953f-7da217aa568d`
