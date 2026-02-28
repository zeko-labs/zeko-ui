---
id: T011
title: "Fix faucet ci typecheck task"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-28T08:16:46Z
updated_at: 2026-02-28T08:18:29Z
---

Fix the faucet `moon` typecheck task so it runs reliably in CI without depending on `pnpm` being available before Moon finishes toolchain setup.

## RED Evidence

- GitHub Actions job `65235309318` failed in `RunTask(faucet:typecheck)`
- The task attempted `pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p test/tsconfig.json`
- CI log showed `/usr/bin/bash: line 1: pnpm: command not found` before `SetupToolchain(unstable_pnpm:10.16.1)` completed

## GREEN Evidence

- `moon -u faucet:typecheck` passed with `tsc --noEmit -p test/tsconfig.json`
- `PATH="/usr/bin:/bin" /Users/hebilicious/.proto/tools/moon/1.41.6/moon -u faucet:typecheck` passed, confirming the task no longer depends on `pnpm` being on `PATH`
