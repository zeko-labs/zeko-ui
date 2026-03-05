---
id: T033
title: "Open-source bridge-sdk and publish docs"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-04T02:07:13Z
updated_at: 2026-03-05T09:30:00Z
---

Open-source `packages/bridge-sdk` with the same monorepo-driven release approach as `faucet-cli`, update the package README, add docs site coverage, and include the npm trusted publishing skill metadata fix in the same branch.

## TDD Exception

This task is dominated by package metadata, CI workflow wiring, release orchestration, codemod-driven import rewrites, and documentation updates. A RED-first test addition is not a practical fit here; validation will be done with targeted build, typecheck, and docs verification after the changes are in place.

## GREEN Evidence

- `pnpm exec moon run graphql:build` — passed
- `pnpm exec moon run graphql:typecheck` — passed
- `pnpm exec moon run bridge-sdk:build` — passed
- `pnpm exec moon run bridge-sdk:typecheck` — passed
- `pnpm exec moon run bridge-ui:typecheck` — passed
- `pnpm exec moon run actions-indexer:build` — passed
- `pnpm exec moon run docs:build` — passed
- `pnpm exec moon run docs:test` — passed (`1` test file passed, `3` tests passed, `1` skipped)

Revalidated after merging the latest `origin/main` and aligning the bridge-sdk/graphql release flows with the updated faucet-cli publishing approach.

Validated both Moon v2 Dockerfile rewrites with real container builds:

- `docker build -f services/actions/indexer/Dockerfile --target build .` — passed
- `docker build -f services/leaderboard/indexer/Dockerfile --target build .` — passed

Revalidated after merging `origin/main` conflict resolution and refactoring sync workflows into a reusable workflow:

- `pnpm exec moon run graphql:build` — passed
- `pnpm exec moon run bridge-sdk:build` — passed
- `pnpm exec moon run bridge-sdk:typecheck` — passed
- `pnpm exec moon run docs:build` — passed
- `pnpm exec moon run docs:test` — passed

Decomposed standalone sync verification:

- Ran `scripts/sync-standalone-package.mjs` against `packages/graphql`, copied to temp standalone repo, then ran:
  - `pnpm install` — passed
  - `moon run graphql:build` — passed
- Ran `scripts/sync-standalone-package.mjs` against `packages/bridge-sdk`, copied to temp standalone repo, then ran:
  - `moon query projects` — passed (project/task discovery works in standalone sync output)
- Ran `scripts/sync-standalone-package.mjs` against `packages/faucet-cli`, copied to temp standalone repo, then ran:
  - `moon query projects` — passed
  - `moon run faucet-cli:check` — passed
