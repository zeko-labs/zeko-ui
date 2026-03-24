---
id: T051
title: "Rename graphql to public package and fix readmes"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-09T15:25:20Z
updated_at: 2026-03-09T15:30:43Z
---

Rename the public GraphQL package from `@zeko/graphql` to `@zeko-labs/graphql`, add repo-wide codemods for the rename and README maintenance, run them on the PR worktree, and revalidate publish/build/docs flows.

## TDD Exception

This task is dominated by codemod-driven package metadata rewrites, release workflow updates, and README maintenance. A RED-first test addition is not a practical fit here; validation will be done with targeted codemod execution, search verification, install, and Moon build/typecheck/docs commands after the changes are in place.

## GREEN Evidence

- `bun scripts/codemods/rename-graphql-to-public.ts` — passed (`18` files updated)
- `bun scripts/codemods/fix-public-package-readmes.ts` — passed (`packages/bridge-sdk/README.md` and `packages/graphql/README.md` updated)
- `rg -n '@zeko/graphql|zeko-graphql-' .changeset .github apps docs packages services pnpm-lock.yaml` — passed (no matches)
- `pnpm install` — passed
- `moon run graphql:build` — passed
- `moon run graphql:typecheck` — passed
- `moon run bridge-sdk:build` — passed
- `moon run bridge-sdk:typecheck` — passed
- `moon run actions-indexer:build` — passed
- `moon run lb-indexer:build` — passed
- `moon run docs:build` — passed
- `moon run docs:test` — passed (`1` test file passed, `3` tests passed, `1` skipped)
