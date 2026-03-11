---
id: T056
title: "Lower initial public package versions to zero"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-09T16:05:00Z
updated_at: 2026-03-09T16:12:00Z
---

Adjust the initial published versions for the public graphql and bridge-sdk packages from `1.0.0` to `0.0.0`, then amend the latest public-release commit and force-push the branch so the first patch release resolves to `0.0.1`.

## TDD Exception

This task is a release metadata correction limited to package manifest versions and commit history surgery on an existing branch. Validation is by inspecting the edited manifests, amending the intended commit, and confirming the force-pushed branch tip.

## GREEN

- Updated the initial public package versions in `packages/graphql/package.json` and `packages/bridge-sdk/package.json` from `1.0.0` to `0.0.0`.
- Amended the latest public-release commit on `feat/open-source-bridge-sdk`.
- Confirmed the corrected versions with:
  - `rg -n '"version": "0\\.0\\.0"' packages/graphql/package.json packages/bridge-sdk/package.json`
- Force-pushed the rewritten branch tip:
  - `git push --force-with-lease origin feat/open-source-bridge-sdk`

## Notes

- `main` did not contain the public-package rename/version work; the amend was applied to the latest public-release commit on `feat/open-source-bridge-sdk`, which is the branch that actually held the `1.0.0` versions.
- Lefthook ran during the amend and completed successfully. It reported the same existing warning-only Biome findings in unrelated areas but did not block the commit.
