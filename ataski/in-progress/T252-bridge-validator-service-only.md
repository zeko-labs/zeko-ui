---
id: T252
title: "Bridge validator service only"
status: in-progress
blockedBy: [T251]
owner: codex
created_at: 2026-05-25T21:28:00Z
updated_at: 2026-05-26T05:28:00Z
---

## Requirements

- Keep PR #150 scoped to `services/bridge-validator` and its lockfile entry.
- Stack PR #150 on the SDK/CLI prerequisite PR so reviewers can test package changes independently.
- Preserve the validator runtime contract: one Cloudflare Worker/Workflow/Sandbox command, 2 hour hard timeout, cleanup after success/failure/timeout, and clear runtime docs.
- Expose enough deployed sandbox diagnostics to identify why a Cloudflare Workflow is waiting when the runner process has already exited.

## Test Plan

- BDD. Validate local service tests and build gates after extracting the branch.
- Deployed-path acceptance remains pending by request: sync secret, deploy, trigger exactly one deposit workflow, collect Workflow instance ID, `operation_id`, final transaction hash, log path, and reporting output.
- Diagnostic follow-up uses DDD: add focused unit coverage for sandbox runner log collection before redeploying and querying the already-started Workflow.

## RED Evidence

- PR #150 previously mixed validator service code with SDK/CLI fixes, making the validator review depend on package changes.

## GREEN Evidence

- Split branch validation:
  - `moon run bridge-validator:test -f` passed: 4 files, 17 tests.
  - `moon run bridge-validator:typecheck -f` passed.
  - `moon run bridge-validator:lint -f` passed.
  - `moon run bridge-validator:build -f` passed with the existing `tsdown` `resolve.tsconfigFilename` warning.
- Local CLI deposit with the sandbox/root wallet completed successfully before this split:
  - Wallet public key: `B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV`.
  - Operation ID: `2c2626e8-eeee-4af3-8980-2d1fbbdf430b`.
  - Submit transaction hash: `5JuWRgKeJSnFUy3ugpkyESzNfsk8P6UxpmsqVkQ1m7zZy1qdpD18`.
  - Final transaction hash: `5JuiUFUukgF4wfQS1HsRjSrxun4nV2gYVEK4k17HWhimxsvb8Dkx`.
  - Log path: `/Users/hebilicious/Library/Logs/zeko-bridge/2c2626e8-eeee-4af3-8980-2d1fbbdf430b.jsonl`.
- Deployed deposit attempt after approval:
  - Workflow instance ID: `37f4fe25-24c3-4a60-b0b7-cbb27ffdb62a`.
  - `start bridge validation command` succeeded and returned process ID `159`.
  - `/bridge-status` later reported `found: false` for the command while the Workflow remained waiting for `bridge-command-complete`.
  - Added `/bridge-status?...&logs=1` diagnostics so the deployed service can report the sandbox runner PID file, process log, stdout, and stderr tails.

## Remaining Work

- Validate the diagnostic change locally, commit, push, redeploy, and query `logs=1` for the deployed Workflow.
- Fix the specific deployed runner/callback blocker identified by the diagnostic response.
- Complete one deployed deposit workflow through Cloudflare and capture `operation_id`, final transaction hash, log path, and reporting output.
