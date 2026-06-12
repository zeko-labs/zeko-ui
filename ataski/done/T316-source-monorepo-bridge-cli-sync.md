---
id: T316
title: "source-monorepo-bridge-cli-sync"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T19:19:06Z
updated_at: 2026-06-12T19:33:04Z
---

## Requirements

- Correct the bridge CLI public mirror workflow so `zeko-labs/bridge-cli` remains a source repository, not a built-artifact-only export.
- Sync a small standalone monorepo that contains `packages/bridge-cli` source and the internal workspace package source it needs for network nomenclature, currently `packages/networks`.
- Keep `@zeko/networks` as a real workspace dependency of `@zeko-labs/bridge-cli` in the source mirror; do not duplicate network constants into the CLI package.
- Keep npm publication for `@zeko-labs/bridge-cli` based on the built CLI artifact from `packages/bridge-cli`, with `@zeko/networks` bundled by the package build and not published as a separate npm dependency.
- Update documentation/tests that incorrectly describe the bridge CLI mirror as a built artifact export.

## Test Plan

- TDD: first update the bridge CLI package-boundary test to assert source-monorepo sync behavior, including synced `packages/bridge-cli/src`, `packages/networks/src`, and workspace package metadata, and to reject the old `dist`-only sync.
- GREEN requires the updated package-boundary test and sync package tests to pass, plus a bridge CLI build proving npm publication still emits a bundled artifact.

## RED Evidence

- `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts` fails after adding the source-mirror assertions because `packages/bridge-cli/package.json` does not declare `@zeko/networks` as a workspace dependency and `.github/workflows/sync-bridge-cli.yaml` still syncs a `dist`-based built package boundary.

## GREEN Evidence

- Updated `.github/workflows/sync-bridge-cli.yaml` to assemble and force-push a public source monorepo containing `packages/bridge-cli` and `packages/networks`; it no longer builds or syncs `packages/bridge-cli/dist` as the public repo payload.
- Added `@zeko/networks` as a `workspace:*` bridge-cli dev dependency and kept it out of runtime dependencies; `@zeko/networks` remains private with a `0.0.0` version so pnpm can resolve workspace protocol during `pnpm pack`.
- Extended `sync-standalone-package` with `--root-dir`, `--project-paths`, and `--preserve-workspace-dependencies`, then covered that mode with an integration test.
- Local source mirror dry-run produced:
  - root `pnpm-workspace.yaml` with `packages/*`
  - `.moon/workspace.yml` mapping `bridge-cli` and `networks`
  - `packages/bridge-cli/src/cli.ts`
  - `packages/networks/src/index.ts`
  - no `packages/bridge-cli/dist`
  - `@zeko/networks` preserved as `workspace:*`
  - `@zeko-labs/bridge-sdk` resolved to a published version range
- Validation passed:
  - `pnpm exec moon run sync-standalone-package:test -f`
  - `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts`
  - `pnpm exec moon run sync-standalone-package:typecheck -f`
  - `pnpm exec moon run bridge-cli:typecheck -f`
  - `pnpm exec moon run bridge-cli:build -f`
  - `pnpm exec moon run bridge-cli:test -f`
  - `pnpm exec moon run -f networks:test networks:typecheck`
  - `pnpm exec moon run -f sync-standalone-package:test sync-standalone-package:typecheck`
  - `git diff --check`
  - `pnpm --dir packages/bridge-cli pack --pack-destination "$pack_dir"` smoke: packed package has no runtime `@zeko/networks` dependency, `dist/cli.js` has no `@zeko/networks` import, and the bundled CLI contains `zeko-m:testnet` and `zeko-mainnet`.
