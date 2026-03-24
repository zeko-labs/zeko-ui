---
id: T137
title: "Add use-zeko public mirror sync"
status: done
blockedBy: [T134]
owner: codex
created_at: 2026-03-11T15:23:20Z
updated_at: 2026-03-11T15:45:30Z
---

## Requirements

- Publish the new public skill from this monorepo to a clean public mirror, reusing existing deterministic sync/export patterns where possible.
- Add the repo-side export assets and workflow wiring needed to sync the skill to a standalone public repository without making the monorepo itself depend on the mirror.
- Keep the public mirror agent-neutral and suitable for external installation.
- Document the authority chain and sync mechanism well enough that future updates remain deterministic and low-maintenance.

## Test Plan

- `BDD`: exercise the export path through failing tests that expect a standalone-ready mirror artifact/config and then verify the sync preparation command produces the expected clean output.
- RED path before implementation: add or extend tests around the standalone-sync tooling before changing it or wiring the new mirror flow.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because `packages/use-zeko/README.md` and `.github/workflows/sync-use-zeko.yaml` do not exist yet.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed with mirror-specific assertions for the standalone-facing `README.md` and `.github/workflows/sync-use-zeko.yaml`.
- `moon run sync-standalone-package:build`
- Passed, producing the reusable standalone export CLI used by the sync workflow.
- Temp-workspace dry run:
  `node packages/sync-standalone-package/dist/cli.js --package-dir packages/use-zeko --project-id use-zeko --workspace-packages .`
- Passed in a temp workspace copy once the expected root `.moon/toolchains.yml` file was included, and produced standalone `pnpm-workspace.yaml`, `.moon/workspace.yml`, `.moon/toolchains.yml`, and catalog-resolved `package.json` metadata for `packages/use-zeko`.
