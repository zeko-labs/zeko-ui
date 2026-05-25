---
id: T252
title: "Bridge validator service only"
status: in-progress
blockedBy: [T251]
owner: codex
created_at: 2026-05-25T21:28:00Z
updated_at: 2026-05-25T21:31:30Z
---

## Requirements

- Keep PR #150 scoped to `services/bridge-validator` and its lockfile entry.
- Stack PR #150 on the SDK/CLI prerequisite PR so reviewers can test package changes independently.
- Preserve the validator runtime contract: one Cloudflare Worker/Workflow/Sandbox command, 2 hour hard timeout, cleanup after success/failure/timeout, and clear runtime docs.
- Do not deploy from this split step.

## Test Plan

- BDD. Validate local service tests and build gates after extracting the branch.
- Deployed-path acceptance remains pending by request: sync secret, deploy, trigger exactly one deposit workflow, collect Workflow instance ID, `operation_id`, final transaction hash, log path, and reporting output.

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

## Remaining Work

- When deployment is approved, sync the root `.env` wallet secret to Cloudflare, deploy, and trigger exactly one deployed deposit workflow.
