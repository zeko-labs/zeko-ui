---
id: T005
title: "Faucet CLI sync publish CI"
status: done
blockedBy: [T004]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:53:56Z
---

Add the monorepo split sync workflow and mirrored npm publish workflow for the
faucet CLI package.

## Validation Plan

This task is CI and packaging configuration only. Validation will use workflow
syntax inspection plus package build assumptions already proven by T004.

## GREEN Evidence

- Workflow YAML syntax parsed successfully via `ruby` for:
  - `.github/workflows/sync-faucet-cli.yaml`
  - `packages/faucet-cli/.github/workflows/publish.yaml`
- `git diff --check` passed in the T005 worktree
- `npm install --package-lock-only --ignore-scripts --dry-run` passed in `packages/faucet-cli`
- PR `#122` merged into `epic/faucet-api-cli-refactor`: https://github.com/zeko-labs/zeko-ui/pull/122
