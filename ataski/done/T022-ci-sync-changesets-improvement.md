---
id: T022
title: "Improve CI: sync with catalog resolution, changesets publishing in external repo"
status: done
blockedBy: [T021]
owner: main
created_at: 2026-03-02T05:00:00Z
updated_at: 2026-03-02T06:00:00Z
---

## TDD Exception

CI/workflow configuration change. Validated by reviewing workflow correctness and running catalog resolution script locally.

## GREEN Evidence

- Catalog resolution script tested locally: correctly resolves `vitest: "catalog:"` → `"3.2.4"` (39 catalog entries parsed)
- All workflow YAML validated for structure correctness
- Old `release-faucet-cli.yml` removed from monorepo root

## Requirements

1. Sync workflow must resolve pnpm catalog deps (`"catalog:"`) to real versions before syncing to external repo.
2. External repo (zeko-labs/faucet-cli) handles publishing via changesets — NOT this repo.
3. Publishing must be atomic: all 7 packages (6 platform + 1 main) succeed or all fail.
4. Release workflow goes inside `packages/faucet-cli/.github/workflows/` so it gets synced.
5. Remove the release workflow from this repo's `.github/workflows/` (publishing happens externally).

## Changes

- Updated `.github/workflows/sync-faucet-cli.yaml`: catalog resolution + on-the-fly `pnpm-workspace.yaml` generation + generic commit message
- Created `packages/faucet-cli/.changeset/config.json`: changesets config with `fixed` group for all 7 packages
- `pnpm-workspace.yaml` NOT checked in (generated at sync time to avoid monorepo conflict)
- Created `packages/faucet-cli/.github/workflows/release.yml`: changesets-driven release with faucet-cli-specific commit/PR title
- Created `packages/faucet-cli/scripts/publish.mjs`: atomic publish script (no `|| true`, fails fast)
- Created `packages/faucet-cli/RELEASE.md`: documents the full release architecture and process
- Added `publish` task to `packages/faucet-cli/moon.yml` (depends on `build`)
- Removed `.github/workflows/release-faucet-cli.yml`: publishing moves to external repo
