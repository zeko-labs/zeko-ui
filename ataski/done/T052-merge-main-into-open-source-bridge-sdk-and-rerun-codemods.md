---
id: T052
title: "Merge main into open-source bridge sdk and rerun codemods"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-09T15:46:28Z
updated_at: 2026-03-09T16:27:00Z
---

Merge `origin/main` into the `feat/open-source-bridge-sdk` worktree, resolve conflicts without dropping the graphql public-package rename and README fixes, rerun the codemods, and revalidate the branch.

## TDD Exception

This task is dominated by merge conflict resolution, codemod reruns, and branch revalidation after integrating `origin/main`. A RED-first test addition is not a practical fit here; validation will be done with git merge conflict resolution, codemod execution, search verification, install, and Moon build/typecheck/docs commands after the merge is complete.

## GREEN

- Merged `origin/main` into `feat/open-source-bridge-sdk` and resolved conflicts in `pnpm-lock.yaml` and `services/actions/indexer/src/helper.ts` without dropping the public package rename work.
- Reapplied the branch-local changes after the merge and resolved the follow-up conflict in `services/actions/indexer/src/helper.ts`.
- Reran the public package codemods after the merge:
  - `bun scripts/codemods/rename-bridge-sdk-to-public.ts`
  - `bun scripts/codemods/rename-graphql-to-public.ts`
  - `bun scripts/codemods/fix-public-package-readmes.ts`
- Verified that no live references remain for the old package names:
  - `rg -n '@zeko/graphql|zeko-graphql-|@zeko/bridge-sdk' .changeset .github apps docs packages services pnpm-lock.yaml`
- Revalidated the merged branch successfully:
  - `moon run graphql:build graphql:typecheck bridge-sdk:build bridge-sdk:typecheck actions-indexer:build lb-indexer:build docs:build docs:test`
- Notes:
  - `docs:build` still emits the existing VitePress/Rolldown plugin warnings, but completed successfully.
  - `actions-indexer:build` completed successfully after the stale `@zeko/bridge-sdk` imports were rewritten to `@zeko-labs/bridge-sdk`.
