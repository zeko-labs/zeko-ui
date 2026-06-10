---
id: T303
title: "Trigger Workers Builds after config sync"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T14:04:12Z
updated_at: 2026-06-10T14:10:44Z
---

## Requirements

- When the GitHub Actions workflow syncs added or modified `workers-build.jsonc` files, it must also trigger the affected Cloudflare Workers Build trigger from GitHub Actions.
- Do not trigger builds during dry-run mode.
- Trigger only remote triggers that match the current branch according to `branchIncludes` and `branchExcludes`.
- Pass the current branch and commit SHA to Cloudflare's `POST /builds/triggers/{trigger_uuid}/builds` endpoint so the build runs for the synced commit.
- Keep operator docs and PR text aligned with the automatic behavior.

## Test Plan

- BDD: first add tests that prove `syncProject` triggers matching builds when requested, skips build triggering during dry-run, and does not trigger branch-excluded triggers.
- RED evidence will be recorded with the failing `moon run cloudflare-build-config:test -f` output before implementation.
- GREEN evidence will include the package test task, typecheck, lint, format, workflow syntax, and a live dry-run sync command.

## RED Evidence

- `moon run cloudflare-build-config:test -f` failed as expected. The new BDD test `syncProject > triggers matching builds after syncing when requested` expected `client.triggerBuild` to be called once for the matching `main` trigger, but it was called 0 times.

## GREEN Evidence

- `moon run cloudflare-build-config:test -f`: passed 9 tests, including post-sync build triggering for a matching `main` trigger, dry-run suppression, and parser handling for `--trigger-builds`.
- `moon run cloudflare-build-config:typecheck -f`: passed with `tsc --noEmit -p tsconfig.json`.
- `moon run cloudflare-build-config:lint -f`: passed Biome checks for `src` and `tests`.
- `moon run cloudflare-build-config:format -f`: passed dprint format check.
- `actionlint -ignore 'label "warp-ubuntu-latest-x64-2x" is unknown' .github/workflows/sync-cloudflare-build-config.yaml`: passed workflow syntax validation; the ignored diagnostic is the repo's custom runner label.
- `moon run cloudflare-build-config:sync-dry-run -- services/actions/api/workers-build.jsonc` with `CFB_TOKEN` from the main worktree `.env`: passed and did not trigger builds in dry-run mode.
