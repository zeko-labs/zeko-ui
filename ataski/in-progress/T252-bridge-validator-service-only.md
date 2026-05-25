---
id: T252
title: "Bridge validator service only"
status: in-progress
blockedBy: [T251]
owner: codex
created_at: 2026-05-25T21:28:00Z
updated_at: 2026-05-26T06:26:00Z
---

## Requirements

- Keep PR #150 scoped to `services/bridge-validator` and its lockfile entry.
- Stack PR #150 on the SDK/CLI prerequisite PR so reviewers can test package changes independently.
- Preserve the validator runtime contract: one Cloudflare Worker/Workflow/Sandbox command, 2 hour hard timeout, cleanup after success/failure/timeout, and clear runtime docs.
- Expose enough deployed sandbox diagnostics to identify why a Cloudflare Workflow is waiting when the runner process has already exited.
- Execute the current published `@zeko-labs/bridge-cli@latest` npm binary path at runtime; do not use a cached Docker install or direct `node` entrypoint call that can mask published CLI defects.
- Add a sandbox watchdog callback so a missing command callback still reaches the Workflow at the 2-hour hard limit.
- Pass callback and wallet environment variables directly on the detached `nohup` launch command so the background process cannot lose the `sandbox.exec` environment.
- Report JSON/history validation step failures as validation failures with command stdout/stderr, even when Cloudflare wraps the original thrown error.

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
- Deployed follow-up findings:
  - `wrangler workflows instances describe` showed the same Workflow still `Waiting` after about 7 hours, despite the intended 2-hour wait timeout.
  - `curl ...&logs=1` after redeploy returned no sandbox files for that old instance, so the old runner failure is no longer diagnosable from sandbox state.
  - Wrangler deploy reused the cached Docker layer for `npm install @zeko-labs/bridge-cli@latest`, proving the previous container image could keep an old latest package.
  - Local `npm --prefer-online exec --package @zeko-labs/bridge-cli@latest -- zeko-bridge --help` returned exit code 0 with no CLI help output for npm latest `0.1.0`, so the current published CLI still no-ops through the npm binary path.
- Fresh deployed deposit after runtime npm-exec/watchdog deploy:
  - Workflow instance ID: `d2897e62-7f4b-4fbd-bd73-fb9d6d52fb1f`.
  - `start bridge validation command` succeeded and returned process ID `155`.
  - `/bridge-status?...&logs=1` initially reported the process running with empty stdout/stderr, then reported no PID or sandbox files while the Workflow still waited for `bridge-command-complete`.
  - This indicates the detached process exited before delivering a callback and the sandbox filesystem was not available after process exit.
- Fresh deployed deposit after direct launch environment fix:
  - Workflow instance ID: `80b423c6-e1bb-48ae-a813-4cf135fc3fe4`.
  - `start bridge validation command` succeeded and returned process ID `332`.
  - `wait for bridge command completion` received the callback after 46 seconds.
  - Callback payload: `exitCode: 0`, `stdout: ""`, `stderr` contained only npm update notices.
  - Workflow failed at `parse bridge result` with `Failed to parse bridge JSON output: No JSON object found in bridge output`.
  - `notify slack runtime failure` succeeded and `destroy bridge sandbox` succeeded.
  - This proves the deployed Cloudflare Worker/Workflow/Sandbox callback path works, but the current published `@zeko-labs/bridge-cli@latest` npm binary still no-ops.

## Remaining Work

- Validate, commit, push, and redeploy the validation failure reporting fix.
- After the published CLI entrypoint fix is released to npm latest, trigger one new deployed deposit workflow.
- Complete one deployed deposit workflow through Cloudflare and capture `operation_id`, final transaction hash, log path, and reporting output.
