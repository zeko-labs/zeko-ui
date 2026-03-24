---
id: T057
title: "Amend main public package versions to zero"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-10T00:36:00Z
updated_at: 2026-03-10T00:55:00Z
---

Amend the merged public-package commit on `origin/main` so the initial published versions for `@zeko-labs/graphql` and `@zeko-labs/bridge-sdk` are `0.0.0` instead of `1.0.0`, then force-push the corrected `main` tip.

## TDD Exception

This is a release metadata correction on an already-merged commit. Validation is by inspecting the updated package manifests, successfully amending the merged commit, and force-pushing the corrected `main` tip.

## GREEN

- Fetched `origin/main` and confirmed the merged public-package commit was `b3f60d4`.
- Created a detached worktree from `origin/main` to avoid disturbing the dirty local `main` checkout.
- Updated `packages/graphql/package.json` and `packages/bridge-sdk/package.json` from `1.0.0` to `0.0.0`.
- Verified the corrected manifest versions with:
  - `rg -n '"version": "0\\.0\\.0"' packages/graphql/package.json packages/bridge-sdk/package.json`
- Amended the merged `main` commit and re-ran the amend after installing and validating Lefthook so the final amended commit had a real `pre-commit` execution.
- Force-pushed the corrected detached `HEAD` to `main`:
  - `git push --force-with-lease origin HEAD:main`

## Notes

- The first amend in the detached worktree happened before Lefthook was installed there, so it was intentionally not pushed.
- After `pnpm install`, `pnpm exec lefthook install`, and `pnpm exec lefthook validate`, the amend was repeated successfully with the Lefthook banner present.
- GitHub accepted the force-push and reported the remote `main` ref moving from `b3f60d4` to `1045f68`.
