---
id: T026
title: "Open-source bridge-sdk and publish docs"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-04T02:07:13Z
updated_at: 2026-03-04T02:24:00Z
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
