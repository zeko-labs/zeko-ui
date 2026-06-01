---
id: T253
title: "Bridge validator service only"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-25T21:28:00Z
updated_at: 2026-06-01T09:35:16Z
---

## Requirements

- Keep PR #150 scoped to the Cloudflare bridge validator service.
- Target PR #150 at `main`; the SDK/CLI prerequisite PR has merged and must not remain as PR #150's base.
- Run one scheduled deposit route and one scheduled withdrawal route through the deployed Worker, Workflow, and Sandbox path.
- Execute the published `zeko-bridge` binary directly from the container, without using local workspace code, direct `node` entrypoints, pinned CLI versions, or `npm exec` as the bridge invocation.
- Enforce a 2 hour Workflow hard stop, keep the sandbox command below that limit, and ensure the Workflow reaches a terminal success or failure callback.
- Destroy the sandbox on success, validation failure, command failure, callback timeout, or runtime failure.
- Protect all Worker HTTP surfaces with bearer-token authentication.
- Keep runtime documentation and Moon tasks aligned with the actual operational commands.
- Reduce the scheduled validator frequency to one route every 12 hours.
- Align bridge deposit and withdrawal retry behavior: retry recoverable setup, status, capability, and mutation failures with exponential backoff for 5 retries, then exit with a useful error.
- Treat `Circuits config not found` and `No key returned from mutation` as bounded-retry failures, not infinite waits or immediate hard exits.
- Avoid growing the bridge queue by clearing exactly one existing queued operation for the route/account before submitting a new operation, and return success once that queued operation is resolved.
- Add a source-build validator path for Cloudflare Sandbox PR validation so unpublished SDK/CLI changes can be tested by cloning and building source instead of waiting for an npm release.
- Move long stderr diagnostics out of Slack message blocks into Slack text snippet uploads while keeping stdout inline.
- Keep the CLI reliability changes in PR #150 because the validator must work with these changes before deployment.
- Replace every current infinite bridge retry path with the same bounded exponential retry policy, not just the two named error strings.
- Add simple validator runtime configuration to disable scheduled runs, choose the source branch/ref for PR-built validation, and manually start one run.
- Prove one deployed validator instance can run with PR-built source configuration without failing in the harness/setup path.

## Test Plan

- BDD. The service tests describe the required runtime contract first: scheduled route fanout, command construction, callback behavior, auth, status diagnostics, result parsing, history-log validation, Slack output, and cleanup.
- Local gates: `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, `moon run bridge-validator:build -f`.
- CLI gates for runtime behavior changes: `moon run bridge-cli:test -f`, `moon run bridge-cli:typecheck -f`, and `moon run bridge-cli:lint -f`.
- Cloudflare gate: deploy the service, trigger exactly one deposit workflow through `bridge-validator:trigger-deposit`, and inspect the Workflow instance plus status endpoint.
- Final acceptance requires one deployed deposit and one deployed withdrawal to complete with `operation_id`, final hash, log path, and reporting output.

## RED Evidence

- PR #150 previously mixed validator service work with SDK/CLI changes, making validator review depend on package code that belongs in a separate PR.
- Early validator attempts did not exercise the deployed Cloudflare path reliably; local CLI runs alone were insufficient.
- The first deployed sandbox runner could exit without delivering a Workflow callback, leaving the Workflow waiting.
- Cloudflare workflow `20944a35-90cc-4c13-abd3-f606fcca1c86` remained waiting for 7 hours while `/bridge-status?instanceId=20944a35-90cc-4c13-abd3-f606fcca1c86&logs=1` reported no process and no diagnostic files; the Workflow must detect that deployed sandbox failure mode without local babysitting.
- The status endpoint initially exposed only process presence, so it could not explain missing callbacks.
- The Worker HTTP surface was unauthenticated.
- The validator docs drifted into manual Wrangler commands and unrelated local secret details instead of the actual service contract.

## GREEN Evidence

- PR split completed:
  - PR-A: SDK/CLI prerequisite branch `branch/bridge-sdk-cli-validator-base`.
  - PR-B: validator-only branch `branch/feature-web-397-bridge-validator-e2e`.
  - PR #150 was later retargeted to `main` after PR-A merged.
  - The validator task was renumbered from `T252` to `T253` because `main` already had a separate `T252`.
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
- Final `codex-review` rerun attempted after the Moon cache fix and was blocked by the Codex usage limit before producing findings: `try again at 11:27 AM`.
- PR #150 was retargeted from `branch/bridge-sdk-cli-validator-base` to `main` after PR-A merged.
- Merge conflicts from `origin/main` were resolved:
  - Kept SDK/CLI behavior from `main`; validator PR #150 no longer carries PR-A package changes.
  - Renumbered this validator task from `T252` to `T253` because `main` already contains `T252`.
  - Removed merged SDK/CLI artifacts from the PR #150 diff.
- Latest `codex-review` findings accepted and fixed:
  - Failed sandbox launcher executions now fail the Workflow immediately instead of returning an empty process id and waiting for the hard timeout.
  - Completed bridge commands now disarm the watchdog before callback retries, preserving the original CLI exit code if callback reporting cannot be delivered within the grace window.
  - Reran `moon run bridge-validator:test -f`: 5 files passed, 25 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - Reran `git diff --check`: passed.
- Next `codex-review` findings accepted and fixed:
  - Status diagnostics now use a non-keepalive sandbox handle, so mistyped or completed `instanceId` lookups do not create leaked keep-alive sandboxes.
  - Workflow callbacks now use a per-run event type derived from the callback token, so a wrong-token callback cannot resume and fail the active wait before the real sandbox callback arrives.
  - Reran `moon run bridge-validator:test -f`: 5 files passed, 27 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - Reran `git diff --check`: passed.
- User cleanup pass:
  - Removed token-bearing status command docs; status tasks now read `VALIDATOR_API_TOKEN` from the repo `.env`.
  - Replaced the Bash secret sync script with Nu scripts for secret sync and status requests.
  - Removed the README wording test and kept behavior/script/runtime tests.
  - Moved the bridge CLI package/version into `services/bridge-validator/package.json`; runtime code and Dockerfile now derive from that metadata.
  - Replaced custom Worker env value trimming/validation with Valibot.
  - Verified `origin/main...HEAD` includes no `packages/bridge-cli`, `packages/bridge-sdk`, or `.changeset` files.
  - Reran `nu scripts/sync-secrets.nu --help`: passed.
  - Reran `nu scripts/status.nu --help`: passed.
  - Reran `pnpm install`: passed.
  - Reran `moon run bridge-validator:test -f`: 4 files passed, 26 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - Reran `git diff --check`: passed.
- Slack timing cleanup:
  - Added sandbox callback timing for the exact published CLI command duration.
  - Added Workflow phase timings for the measured validation steps and includes them in success, process failure, validation failure, and runtime failure reporting.
  - Replaced plain Slack-only output with Block Kit success/failure payloads, structured route/evidence fields, final transaction explorer links when available, and exact millisecond durations.
  - Updated README/AGENTS runtime docs so operators expect Slack success/failure reports with workflow, command, and step timing.
  - Reran `moon run bridge-validator:test -f`: 4 files passed, 28 tests passed.
  - Reran `moon run bridge-validator:typecheck -f`: passed.
  - Reran `moon run bridge-validator:lint -f`: passed.
  - Reran `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - Reran `git diff --check`: passed.
- Cloudflare deposit validation pass:
  - Deployed Worker version `1be80707-903f-478b-8b5a-4f92494a6f2d`.
  - Added application-level Sandbox control timeouts, HTTP status timeouts, and an authenticated `/bridge-cleanup` route after Cloudflare Sandbox startup/control calls were observed hanging during terminated attempts.
  - Added `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` support so Cloudflare validation uses a dedicated funded wallet instead of implicitly selecting shared numbered bridge test keys with unrelated queues.
  - Synced Cloudflare secrets from `/Users/hebilicious/GitHub/zeko-ui/.env` through `moon run bridge-validator:sync-secrets -f`.
  - Destroyed stale Sandboxes for terminated attempts with `moon run bridge-validator:cleanup -f`.
  - Triggered exactly one clean dedicated-wallet deposit workflow after cleanup: `7ccba267-7e54-41d7-9722-70919e0aec62`.
  - Workflow `7ccba267-7e54-41d7-9722-70919e0aec62` completed successfully through Cloudflare Worker, Workflow, and Sandbox.
  - CLI operation id: `794e477f-6ec0-479c-bf02-b2824c8712c3`.
  - Submitted deposit hash: `5Jthv81XKtFQX2UiaNqjJoRzQeBoPxmJYVQ4aKfjGDK3VtxDDc5r`.
  - Final transaction hash: `5JvExzCAP97JitHX2kReCKjbKEWAfJdomJGjHZrdSpWf7rrbLay2`.
  - History log path: `/workspace/state/zeko-bridge/logs/794e477f-6ec0-479c-bf02-b2824c8712c3.jsonl`.
  - Workflow success reporting step `report bridge validation success-1` succeeded.
  - Workflow cleanup step `destroy bridge sandbox-1` succeeded.
  - The deposit command ran from `2026-05-26T16:29:15.898Z` to `2026-05-26T17:57:36.946Z`.
- Current reliability cleanup:
  - Reduced the validator cron cadence from every 6 hours to every 12 hours.
  - Added a bounded exponential retry helper for bridge CLI setup/status/capability/mutation operations: 5 retries, 6 total attempts, then a concrete failure.
  - Aligned deposit and withdrawal behavior for `Circuits config not found` and `No key returned from mutation` so they do not retry indefinitely or hard-exit inconsistently.
  - Changed the high-level withdrawal flow to inspect the queue before submitting, matching deposit behavior.
  - Changed the high-level bridge flow to resolve exactly one pre-existing queued operation and return success without submitting another operation.
  - Added an explicit Cloudflare Sandbox source-build path for PR validation before SDK/CLI publication: clone source, build `bridge-cli`, then run the built CLI.
  - Changed Slack failure reporting to keep stdout inline and upload stderr as a Slack text snippet.
  - Did not deploy or trigger Cloudflare workflows in this pass.
  - `moon run bridge-cli:test -f`: 22 files passed, 111 tests passed, 13 skipped.
  - `moon run bridge-cli:typecheck -f`: passed.
  - `moon run bridge-cli:lint -f`: passed.
  - `moon run bridge-cli:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - `moon run bridge-validator:test -f`: 4 files passed, 31 tests passed.
  - `moon run bridge-validator:typecheck -f`: passed.
  - `moon run bridge-validator:lint -f`: passed.
  - `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
  - `git diff --check`: passed.

## Remaining Work

- Review whether the CLI reliability changes should remain in PR #150 or be split again into a prerequisite SDK/CLI PR before PR #150 is finalized.
- After the source-build path is deployed intentionally, trigger one source-built Cloudflare deposit and one source-built Cloudflare withdrawal if the SDK/CLI changes are still unpublished.
- Trigger one withdrawal through Cloudflare to capture final acceptance evidence.
- Commit and push after the PR scope is confirmed and any required Cloudflare validation is complete.
