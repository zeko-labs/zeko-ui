---
id: T306
title: "Add workflow Moon run guard"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T15:09:39Z
updated_at: 2026-06-10T15:17:20Z
---

## Requirements

- Add an automated guard that scans GitHub Actions workflow files for `moon run` commands.
- The guard must fail when a workflow runs a Moon target whose task is not explicitly CI-runnable.
- The guard must allow workflow-only tasks when invoked through `moon exec --ignore-ci-checks`.
- Add repository instructions that new worktrees must not check out `main`; keep `main` reserved for the root checkout.

## Test Plan

- BDD: first add a failing workflow-guard test that identifies at least one non-CI Moon task invoked via `moon run` in fixture content.
- GREEN evidence will include the focused guard tests, package typecheck/lint, and a repo workflow scan against current checked-in workflows.

## RED Evidence

- `moon run cloudflare-build-config:test -f` initially failed after adding the BDD tests because `../src/workflow-moon-run-guard.ts` did not exist.
- A first attempt in the fresh worktree failed earlier with `vitest: command not found`; `pnpm install --frozen-lockfile` was required because the new worktree had no dependencies linked.

## GREEN Evidence

- `moon run cloudflare-build-config:test -f`: passed 12 Vitest tests, including the repo workflow scan.
- `moon run cloudflare-build-config:typecheck -f`: passed.
- `moon run cloudflare-build-config:lint -f`: passed after fixing import order.
- `moon run cloudflare-build-config:format -f`: passed.
- `moon query tasks --project cloudflare-build-config` showed `.github/workflows/*.yaml` and `.github/workflows/*.yml` included in `cloudflare-build-config:test` inputs.
- `moon query tasks --affected --project cloudflare-build-config` included `cloudflare-build-config:test`, confirming the guard is selected for the current workflow/tooling changes.
