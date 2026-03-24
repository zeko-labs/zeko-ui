---
id: T015
title: "Phase 1: Integration tests against current Node CLI"
status: in-progress
blockedBy: []
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-01T01:00:00Z
---

Add language-agnostic integration tests that invoke the compiled binary as a subprocess.
These validate the contract and later prove feature parity with the Rust binary.

## Scope

Create `packages/faucet-cli/test/integration.test.ts` with subprocess-based tests:

- `zeko-faucet --help` → exit 0, stdout lists both subcommands
- `zeko-faucet --version` → exit 0, stdout contains version string
- `zeko-faucet claim --help` → exit 0, stdout contains "Claim faucet tokens"
- `zeko-faucet whoami --help` → exit 0, stdout contains "Verify the current GitHub token"
- `zeko-faucet claim` (no address, no token) → non-zero exit code
- `zeko-faucet claim B62abc --token invalid --json` → exit non-zero, valid JSON with `success: false`
- `zeko-faucet whoami --token invalid --json` → exit non-zero, valid JSON with `success: false`
- `zeko-faucet claim B62abc extra --token ghp_xxx --json` → exit 1, "invalid_arguments"
- `zeko-faucet whoami unexpected --token ghp_xxx --json` → exit 1, "invalid_arguments"

Use `node:child_process` `execFile` to spawn `node bin/zeko-faucet.js`.

## Verification

- `moon faucet-cli:build && moon faucet-cli:test`

## RED Evidence

`moon run faucet-cli:test -f` — 4 of 9 integration tests failed (help/version tests):

- `--help exits 0 and lists both subcommands` → expected '' to contain 'claim'
- `--version exits 0` → expected '' to match version regex
- `claim --help` → empty stdout
- `whoami --help` → empty stdout
  Root cause: vitest sets TEST/NODE_ENV/TINYPOOL_WORKER_ID env vars which citty/consola detect and suppress output.

## GREEN Evidence

`moon run faucet-cli:test -f` — All 42 tests pass (5 files):

- test/integration.test.ts: 9 tests passed
- test/api.test.ts: 14 passed
- test/cli.test.ts: 4 passed
- test/support.test.ts: 11 passed
- test/commands.test.ts: 4 passed
  Fix: `cleanEnv()` strips TEST, NODE_ENV, TINYPOOL_WORKER_ID, and VITEST* vars from child process env.
