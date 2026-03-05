---
id: T034
title: "Harden release checks and sync package tooling"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-05T18:10:00Z
updated_at: 2026-03-05T18:50:00Z
---

Remove duplicate release publish checks, document the reusable sync workflow, and migrate `sync-standalone-package` into a package project with integration coverage.

## TDD Exception

This task primarily changes CI workflows, packaging/tooling structure, and automation scripts. RED-first unit tests are not practical for workflow execution paths; validation will rely on integration-style script tests and targeted Moon task execution.

## GREEN Evidence

- `pnpm install` — passed
- `pnpm exec moon run sync-standalone-package:build` — passed
- `pnpm exec moon run sync-standalone-package:typecheck` — passed
- `pnpm exec moon run sync-standalone-package:test` — passed (`1` integration test passed)
- `pnpm exec moon run graphql:build bridge-sdk:typecheck` — passed

Decomposed local sync validation (using the built package CLI):

- Created a temp workspace skeleton and ran:
  - `node packages/sync-standalone-package/dist/cli.js --package-dir packages/faucet-cli --project-id faucet-cli --workspace-packages ".,npm/*"` — passed
  - Copied prepared package into a standalone temp repo and ran `moon query projects` — passed (standalone Moon project/task discovery works)

Follow-up hardening:

- Reworked `sync-standalone-package` integration test to use committed fixture files under `tests/fixtures/workspace` (with `.fixture.*` extensions to avoid pnpm pickup), then materialize real file names in a temp workspace during test execution.
- Added package README documenting purpose, CLI usage, and arguments.
- `pnpm exec moon run sync-standalone-package:typecheck` — passed
- `pnpm exec moon run sync-standalone-package:test` — passed
