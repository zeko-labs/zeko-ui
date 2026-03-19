---
id: T098
title: "Fix bridge-cli release workflow review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T08:32:43Z
updated_at: 2026-03-19T08:46:40Z
---

## Requirements

- remove `workflow_dispatch` from the bridge CLI release workflow so the workflow identity matches the trusted-publishing guidance
- validate the remaining release-review findings against the current branch state and fix the ones that are real
- specifically address the GitHub release / mirror sync race so the standalone release tag points at the synced mirror contents for the published version
- keep the release flow changes consistent with the existing changesets-driven monorepo publishing model
- update release documentation where needed so the documented release path matches the workflow behavior

## Test Plan

- Strategy: BDD
- capture the pre-fix release workflow/doc mismatch as RED evidence by inspecting the workflow and release guide together
- validate GREEN with targeted workflow/doc inspection plus docs build coverage if documentation changes are made

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-19 by inspecting the current branch state:

- `.github/workflows/release-bridge-cli.yaml` still declares `workflow_dispatch`, and its version-check step explicitly treats manual dispatch as a forced publish path
- `packages/bridge-cli/RELEASE.md` still documents trusted publishing as valid only through `changesets.yaml`, so the manual dispatch path and the documented OIDC setup disagree
- `release-bridge-cli.yaml` currently runs `github-release` and `sync` in parallel after publish, while `github-release-bridge-cli.yaml` creates the standalone tag without pinning a target revision, so the release can point at stale mirror contents

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-19:

- `moon run docs:build`
- inspected `.github/workflows/release-bridge-cli.yaml`
- inspected `.github/workflows/github-release-bridge-cli.yaml`
- inspected `packages/bridge-cli/RELEASE.md`

Confirmed outcomes:

- `release-bridge-cli.yaml` is no longer manually dispatchable
- the release workflow no longer force-publishes on `workflow_dispatch`
- standalone GitHub release creation now waits for mirror sync and pins `--target main`
- release docs now describe only the changesets-driven release path and the sync-before-release behavior
