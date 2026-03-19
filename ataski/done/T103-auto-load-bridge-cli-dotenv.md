---
id: T103
title: "Auto-load bridge-cli dotenv files"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T18:45:00Z
updated_at: 2026-03-19T18:46:00Z
---

## Requirements

- Make the bridge CLI automatically load environment variables for human users via dotenv.
- Load `.env` files in this precedence order before falling back to already-exported global environment variables:
  - `~/.zeko/.env`
  - a sibling `.env` next to the CLI binary
  - a sibling `.env` next to the invocation path
- Skip candidate files that do not exist or are not readable, without crashing the CLI.
- Preserve the existing `WALLET_PRIVATE_KEY` contract and make the behavior covered by tests and docs.

## Test Plan

- DDD.
- RED path:
  - inspect the current CLI startup path
  - confirm it never loads dotenv files automatically
- GREEN path:
  - add targeted tests for ordered dotenv resolution and fallback behavior
  - rerun `moon run bridge-cli:test`
  - rerun `moon run bridge-cli:typecheck`

## RED Evidence

- `packages/bridge-cli/src/cli.ts` currently constructs and runs the command tree without any dotenv loading step.
- `packages/bridge-cli/src/core/signer.ts` reads only `process.env.WALLET_PRIVATE_KEY`, so humans must export it manually today even when a local `.env` file exists.

## GREEN Evidence

- Added `packages/bridge-cli/src/core/env.ts` to load dotenv files in the requested order:
  - `~/.zeko/.env`
  - sibling `.env` next to the CLI binary
  - sibling `.env` next to the invocation path
  - then inherited environment variables as the fallback
- The loader skips missing or unreadable files and preserves first-file-wins precedence across dotenv candidates.
- Wired the loader into CLI startup in `packages/bridge-cli/src/cli.ts`, so human invocations now auto-load env files before command execution.
- Added targeted regression coverage in `packages/bridge-cli/tests/env.test.ts`.
- Added the `dotenv` runtime dependency to `packages/bridge-cli/package.json` and updated the workspace lockfile.
- Updated `packages/bridge-cli/README.md`, `packages/bridge-cli/testing.md`, and `packages/bridge-cli/AGENTS.md` to document the automatic env resolution order.
- Re-ran:
  - `pnpm --dir packages/bridge-cli exec vitest run tests/env.test.ts tests/cli.test.ts tests/signer.test.ts --config vitest.config.ts`
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run docs:build`
