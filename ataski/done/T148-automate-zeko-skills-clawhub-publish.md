---
id: T148
title: "Automate zeko-skills ClawHub publish"
status: done
blockedBy: [T147]
owner: codex
created_at: 2026-03-24T14:50:00Z
updated_at: 2026-03-24T14:55:00Z
---

## Requirements

- Replace the manual-only ClawHub workflow with an automatic CI path that republishes the `zeko` skill whenever the public skill contents change on `main`.
- Keep the publish gated behind the existing zeko-skills validation and public-install checks so CI does not publish broken bundles.
- Use a deterministic versioning scheme that produces a unique valid semver for each automatic ClawHub publish without requiring a manual version bump on every content change.
- Document how the `CLAWHUB_TOKEN` is obtained and where it must be configured for CI.

## Test Plan

- DDD. First confirm the current workflow is manual-only and that ClawHub publish requires unique semver versions.
- After implementation, run the local validator/test suite, inspect the workflow YAML, and run the publish command locally with an automatically generated version string to prove the path works.

## RED Evidence

- Current `.github/workflows/publish-zeko-skills-clawhub.yaml` is `workflow_dispatch` only, so skill changes on `main` do not automatically republish to ClawHub.

## GREEN Evidence

- `.github/workflows/sync-zeko-skills.yaml` now auto-publishes to ClawHub on `push` to `main` after mirror sync and public-install validation.
- `packages/zeko-skills/src/publish-clawhub.ts` now derives a unique CI semver from the base package version plus `GITHUB_RUN_NUMBER` and `GITHUB_RUN_ATTEMPT` when an explicit version is not provided.
- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:check`
- `packages/zeko-skills/tests/publish-clawhub.test.ts` covers automatic version and changelog derivation.
