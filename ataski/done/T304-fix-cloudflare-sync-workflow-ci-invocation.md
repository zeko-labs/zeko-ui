---
id: T304
title: "Fix Cloudflare sync workflow CI invocation"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T14:32:15Z
updated_at: 2026-06-10T14:32:15Z
---

## Requirements

- Fix the post-merge `Sync Cloudflare Workers Builds` workflow failure caused by running a non-`runInCI` Moon task through `moon run`.
- Keep the workflow syncing changed `workers-build.jsonc` files and triggering builds on non-dry-runs.
- Follow the repository Moon guidance for workflow-only tasks by using `moon exec --ignore-ci-checks`.

## Test Plan

- DDD: reproduce the CI behavior locally with `CI=true` to confirm `moon run` filters the task out, then verify the workflow syntax and `moon exec --ignore-ci-checks` invocation.
- GREEN evidence will include a local dry-run command using the CI invocation path and a rerun/dispatch of the GitHub workflow.

## RED Evidence

- Post-merge GitHub Actions run `27283477097` failed in `Sync configs` with `No tasks found. Unable to execute action pipeline. For targets cloudflare-build-config:sync.`

## GREEN Evidence

- `moon run cloudflare-build-config:test -f`: passed 9 Vitest tests.
- `actionlint -ignore 'label "warp-ubuntu-latest-x64-2x" is unknown' .github/workflows/sync-cloudflare-build-config.yaml`: passed.
- `CI=true moon exec --ignore-ci-checks cloudflare-build-config:sync-dry-run -- services/actions/api/workers-build.jsonc`: passed with `CFB_TOKEN` mapped to `CLOUDFLARE_API_TOKEN` and the checked-in Cloudflare account id.
