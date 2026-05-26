---
id: T252
title: "Bridge validator service only"
status: in-progress
blockedBy: [T251]
owner: codex
created_at: 2026-05-25T21:28:00Z
updated_at: 2026-05-26T03:33:50Z
---

## Requirements

- Keep PR #150 scoped to the Cloudflare bridge validator service.
- Stack PR #150 on the SDK/CLI prerequisite PR so the validator can depend on the fixed published CLI contract without carrying SDK/CLI source changes.
- Run one scheduled deposit route and one scheduled withdrawal route through the deployed Worker, Workflow, and Sandbox path.
- Execute the published `zeko-bridge` binary directly from the container, without using local workspace code, direct `node` entrypoints, pinned CLI versions, or `npm exec` as the bridge invocation.
- Enforce a 2 hour Workflow hard stop, keep the sandbox command below that limit, and ensure the Workflow reaches a terminal success or failure callback.
- Destroy the sandbox on success, validation failure, command failure, callback timeout, or runtime failure.
- Protect all Worker HTTP surfaces with bearer-token authentication.
- Keep runtime documentation and Moon tasks aligned with the actual operational commands.

## Test Plan

- BDD. The service tests describe the required runtime contract first: scheduled route fanout, command construction, callback behavior, auth, status diagnostics, result parsing, history-log validation, Slack output, and cleanup.
- Local gates: `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, `moon run bridge-validator:build -f`.
- Cloudflare gate: deploy the service, trigger exactly one deposit workflow through `bridge-validator:trigger-deposit`, and inspect the Workflow instance plus status endpoint.
- Final acceptance remains blocked until npm `@zeko-labs/bridge-cli@latest` contains the fixed entrypoint from PR #184, then one deployed deposit and one deployed withdrawal must complete with `operation_id`, final hash, log path, and reporting output.

## RED Evidence

- PR #150 previously mixed validator service work with SDK/CLI changes, making validator review depend on package code that belongs in a separate PR.
- Early validator attempts did not exercise the deployed Cloudflare path reliably; local CLI runs alone were insufficient.
- The first deployed sandbox runner could exit without delivering a Workflow callback, leaving the Workflow waiting.
- The status endpoint initially exposed only process presence, so it could not explain missing callbacks.
- The Worker HTTP surface was unauthenticated.
- The validator docs drifted into manual Wrangler commands and unrelated local secret details instead of the actual service contract.

## GREEN Evidence

- PR split completed:
  - PR-A: SDK/CLI prerequisite branch `branch/bridge-sdk-cli-validator-base`.
  - PR-B: validator-only branch `branch/feature-web-397-bridge-validator-e2e`.
  - PR #150 is based on PR-A and contains only `services/bridge-validator`, lockfile, and this Ataski task.
- Local service validation passed on the split branch:
  - `moon run bridge-validator:test -f`: 4 files passed.
  - `moon run bridge-validator:typecheck -f`: passed.
  - `moon run bridge-validator:lint -f`: passed.
  - `moon run bridge-validator:build -f`: passed with the existing `tsdown` deprecation warning.
- Deployed Cloudflare path was exercised for deposit:
  - Workflow instance `37f4fe25-24c3-4a60-b0b7-cbb27ffdb62a` launched sandbox process `159` but remained waiting after the process disappeared.
  - Diagnostics were added to expose sandbox PID, process log, stdout, and stderr tails through `/bridge-status`.
  - Workflow instance `d2897e62-7f4b-4fbd-bd73-fb9d6d52fb1f` showed the detached process could still disappear without a callback.
  - The launch command was fixed to pass callback and wallet environment directly to the detached runner.
  - Workflow instance `80b423c6-e1bb-48ae-a813-4cf135fc3fe4` reached the callback step, reported command stdout/stderr, sent Slack failure output, and destroyed the sandbox.
- Current deployed blocker:
  - `80b423c6-e1bb-48ae-a813-4cf135fc3fe4` failed at `parse bridge result` because the published CLI callback returned `exitCode: 0`, empty stdout, and only npm notices on stderr.
  - This proves the deployed Worker/Workflow/Sandbox path is wired, but a successful deposit cannot be captured until the fixed CLI entrypoint is published as npm latest.
- Cleanup pass validation:
  - Restored this task with the PR split, deployed-path attempts, callback evidence, current blocker, and remaining live-validation work.
  - Removed unrelated root-env guidance from operator docs.
  - Moved Workflow/request/env code out of `src/index.ts`, added bearer auth for Worker HTTP endpoints, switched the bridge invocation to direct `zeko-bridge`, added Moon operator tasks, removed manual `env.d.ts`, and set the sandbox instance type to `lite`.
  - `moon run bridge-validator:test -f`: 4 files passed, 20 tests passed.
  - `moon run bridge-validator:typecheck -f`: passed.
  - `moon run bridge-validator:lint -f`: passed.
  - `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - `moon run bridge-validator:type-cf -f`: passed and regenerated Worker types from Wrangler config.
  - `git diff --check`: passed.
- `codex-review` findings accepted and fixed:
  - Removed secret environment serialization from the sandbox launch command; secrets are passed only through the `sandbox.exec` environment.
  - Changed Slack success reporting to fail the Workflow if Slack rejects the success message.
  - Reran `moon run bridge-validator:test -f`: 4 files passed, 21 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
- Second `codex-review` findings accepted and fixed:
  - Shortened the sandbox command timeout to 115 minutes under the 2 hour Workflow wait, leaving 5 minutes for timeout callbacks and failure reporting.
  - Replaced the hard-coded callback host with `BRIDGE_VALIDATOR_BASE_URL` from Wrangler configuration so non-production deployments can route callbacks to their own Worker.
  - Reran `moon run bridge-validator:type-cf -f`: passed and regenerated Worker types from Wrangler config.
  - Reran `moon run bridge-validator:test -f`: 4 files passed, 22 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
- Third `codex-review` finding accepted and fixed:
  - Pinned `@cloudflare/sandbox` to `0.7.21` and updated the Docker image to `cloudflare/sandbox:0.7.21` so the SDK and container versions match.
  - Added a regression test that fails if the SDK dependency and Docker image tag drift.
  - Reran `moon run bridge-validator:test -f`: 5 files passed, 23 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
- Fourth `codex-review` finding accepted and fixed:
  - Disabled Moon cache for live operator tasks so secret syncs, workflow triggers, instance listing, instance describes, and status requests always execute.
  - Reran `moon run bridge-validator:test -f`: 5 files passed, 23 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - Reran `git diff --check`: passed.
  - Verified `moon task bridge-validator:trigger-deposit --json` reports `"cache": false`.

## Remaining Work

- Rerun `codex-review` after the Moon operator task cache fix and address any remaining actionable validator-scope findings.
- After PR #184 is published to npm latest, redeploy and trigger one deposit plus one withdrawal through Cloudflare to capture final acceptance evidence.
