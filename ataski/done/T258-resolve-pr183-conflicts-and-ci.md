---
id: T258
title: "Resolve PR183 conflicts and CI"
status: done
blockedBy: [T257]
owner: codex
created_at: 2026-05-21T15:23:45Z
updated_at: 2026-05-21T15:29:22Z
---

## Requirements

- Resolve PR 183 merge conflicts against `origin/main`.
- Fix the failing CI checks visible on PR 183:
  - `Workers Builds: actions-api`
  - `Workers Builds: bridge`
- Preserve the reviewed deployment invariant: no live deploy commands are run locally, and Cloudflare Build should not deploy mainnet before review.
- Keep the implementation review log updated for any extra decisions not already documented.
- Re-run relevant validation before committing and pushing the conflict/CI fix.

## Test Plan

- DDD: inspect PR check rollup and merge `origin/main` locally to identify conflict files and failure causes.
- GREEN validation:
  - `git status --short`
  - targeted Moon checks for changed projects
  - PR check rollup after push

## RED Evidence

- `gh pr view 183 --json mergeStateStatus,statusCheckRollup` reported `mergeStateStatus: DIRTY`.
- The same PR check rollup reported failures for `Workers Builds: actions-api` and `Workers Builds: bridge`.

## GREEN Evidence

- Merged `origin/main` into `branch/bridge-mainnet-readiness-plan` and resolved conflicts in:
  - `packages/zeko-skills/src/spec.ts`
  - `packages/zeko-skills/zeko/references/40-endpoints-and-curl.md`
- Initially disabled stale PR preview deploy entrypoints with no-op commands. This was incorrect because it hid the failing preview path instead of fixing it; T259 restores real preview deployments and points preview uploads at the testnet Wrangler env.
- Confirmed no conflict markers or unresolved paths remained with `git diff --name-only --diff-filter=U`.
- Local validation passed:
  - `moon exec --ignore-ci-checks actions-api:deploy-preview`
  - `moon exec --ignore-ci-checks bridge-ui:deploy-preview`
  - `moon run zeko-skills:validate`
  - `moon run zeko-skills:test`
  - `moon run actions-api:typecheck`
  - `moon run bridge-ui:typecheck`
  - `moon run actions-api:lint`
  - `moon run bridge-ui:lint`
  - `moon run zeko-skills:typecheck`
  - `git diff --check`
