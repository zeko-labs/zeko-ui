---
id: T320
title: "make sync tooling monorepo first"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T22:44:06Z
updated_at: 2026-06-12T23:01:01Z
---

## Requirements

- Update `packages/sync-standalone-package` so source mirrors are assembled as monorepos by the sync tooling instead of bespoke workflow shell.
- Add an argument that accepts one or more package paths to include in the exported monorepo; it must handle the bridge CLI case with `packages/bridge-cli` plus `packages/networks`.
- Update `.github/workflows/sync-package-repo.yaml` to use the new monorepo assembly path directly and remove the `pre-sync-task` input/step.
- Update `.github/workflows/sync-bridge-cli.yaml` so it calls the reusable sync workflow instead of hand-assembling a `SYNC_ROOT`.
- Single-package mirrors should still work, but their exported source should be a monorepo rooted at the repository root with the selected package under its package path rather than a flattened package directory.

## Test Plan

- TDD: first add/update sync-tooling and workflow-boundary tests that assert the reusable workflow exposes monorepo package arguments, no longer exposes `pre-sync-task`, and the bridge CLI workflow uses the reusable workflow with both bridge CLI and networks packages.

## RED Evidence

- `pnpm exec moon run sync-standalone-package:test -f -- --run tests/sync-standalone-package.integration.test.ts tests/repo-typecheck-tooling.test.ts` failed because `prepareStandalonePackage` reported `No package.json files found` when asked to assemble selected package paths into an empty output monorepo.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts` failed because `.github/workflows/sync-bridge-cli.yaml` still hand-assembles the mirror and does not use `.github/workflows/sync-package-repo.yaml`.

## GREEN Evidence

- `pnpm exec moon run sync-standalone-package:test -f -- --run tests/sync-standalone-package.integration.test.ts tests/repo-typecheck-tooling.test.ts` passed.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts tests/bridge-machine.test.ts` passed.
- `pnpm exec moon run zeko-skills:test -f -- --run tests/mirror-sync.test.ts` passed.
