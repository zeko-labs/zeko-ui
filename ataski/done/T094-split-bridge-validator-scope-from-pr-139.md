---
id: T094
title: "Split bridge-validator scope from PR 139"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T15:40:00Z
updated_at: 2026-03-12T15:55:00Z
---

## Requirements

- Remove the bridge-validator release/e2e scope from `canonical/bridge-cli` so PR #139 is focused on bridge-cli, bridge-sdk, bridge-ui, and bridge docs work only.
- Move the bridge-validator changes into a dedicated worktree and branch named `feature/web-397-bridge-validator-e2e`.
- Preserve validator-related history accurately rather than manually reimplementing the changes in a way that risks drift.
- Keep the canonical Ataski board only in the canonical worktree; the new validator worktree must not become a second writable board.
- Update the canonical branch as needed so the validator files and validator-only release workflow changes no longer appear in the PR #139 diff.
- Record the exact branch/worktree actions and any follow-up risk in GREEN evidence.

## Test Plan

- DDD. First confirm which files in `origin/main...canonical/bridge-cli` belong to the validator scope, then verify that the canonical branch diff no longer includes those files while the new `feature/web-397-bridge-validator-e2e` branch/worktree does.
- Validate by checking `git diff --name-only origin/main...<branch>` on both branches and confirming the expected file split.

## RED Evidence

- `git -C /Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli diff --name-only origin/main...HEAD` currently shows bridge-validator files mixed into PR #139, including:
  - `services/bridge-validator/**`
  - validator-related release/docs/workflow files mixed into the same branch as bridge-cli changes

## GREEN Evidence

- Created dedicated validator worktree from `origin/main`:
  - `/Users/hebilicious/GitHub/.ataski/worktrees/feature-web-397-bridge-validator-e2e`
- Created and pushed dedicated validator branch:
  - `branch/feature-web-397-bridge-validator-e2e`
  - remote: `origin/branch/feature-web-397-bridge-validator-e2e`
- Extracted validator service files into that branch and validated them there:
  - `moon run bridge-validator:test`
  - `moon run bridge-validator:typecheck`
  - `moon run bridge-validator:lint`
  - `moon run bridge-validator:build`
- Validator extraction commit:
  - `9eb88ec feat(bridge-validator): extract cloudflare e2e worker`
- Canonical branch cleanup removed validator service files from PR #139 scope and trimmed validator-only operator steps out of `packages/bridge-cli/README.md`.
