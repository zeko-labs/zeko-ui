---
id: T108
title: "Split non-bridge-cli PR from canonical branch"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T20:10:00Z
updated_at: 2026-03-19T20:38:00Z
---

## Requirements

- Create a companion branch from `origin/main` that contains the changes from `canonical/bridge-cli` which are unrelated to VitePress and unrelated to the new `packages/bridge-cli` package.
- Keep the split clean: exclude `packages/bridge-cli/**`, exclude VitePress/docs-only changes in `apps/docs/**`, and exclude internal board/task churn that should not be part of the review branch.
- Preserve the relevant SDK/UI/runtime behavior changes so they can be reviewed and merged independently before the bridge-cli package lands.
- Keep the original `canonical/bridge-cli` branch intact; the new branch should duplicate the eligible deltas rather than rewriting the existing PR branch.

## Test Plan

- DDD
- RED path:
  - inventory the diff in `origin/main..canonical/bridge-cli` and confirm the desired split still mixes SDK/UI changes with bridge-cli and VitePress work
- GREEN path:
  - create a new branch from `origin/main`
  - apply only the non-bridge-cli, non-VitePress changes
  - run targeted test/typecheck coverage for the touched packages
  - commit the split branch and report the exact scope that moved

## RED Evidence

- `origin/main..canonical/bridge-cli` currently mixes `packages/bridge-cli/**`, VitePress docs, bridge-sdk/runtime changes, bridge-ui changes, GraphQL changes, and workflow changes in the same review branch.
- The split cannot be represented by a clean cherry-pick sequence because commits such as `fd6eb5e` and `147d5f7` contain both bridge-cli and non-bridge-cli changes.

## GREEN Evidence

- Created worktree `/Users/hebilicious/GitHub/.ataski/worktrees/T108-split-non-bridge-cli-pr` on branch `branch/T108-split-non-bridge-cli-pr` from `origin/main`.
- Applied only the `apps/bridge-ui/**`, `packages/bridge-sdk/**`, and `packages/graphql/src/zeko.ts` changes from `canonical/bridge-cli`, leaving out `packages/bridge-cli/**`, `apps/docs/**`, root workflow churn, and Ataski board files.
- Committed the split branch as `cec7d6b` (`fix(bridge): split sdk and ui changes from bridge-cli pr`).
- Pushed the branch to `origin/branch/T108-split-non-bridge-cli-pr`.
- Opened PR [#152](https://github.com/zeko-labs/zeko-ui/pull/152) against `main`.
- Verified on the split branch with:
  - `moon run bridge-sdk:test bridge-sdk:typecheck bridge-ui:test bridge-ui:typecheck graphql:typecheck`
