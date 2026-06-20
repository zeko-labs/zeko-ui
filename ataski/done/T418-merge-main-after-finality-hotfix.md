---
id: T418
title: "Merge main after finality hotfix"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-20T04:34:17Z
updated_at: 2026-06-20T04:36:34Z
---

## Requirements

- Merge the latest `origin/main` into `branch/bridge-finality-hotfix`.
- Treat fixes already landed on `main` as authoritative during conflict resolution.
- Preserve only the PR-specific bridge finality, wallet-env, CLI override, and diagnostics fixes that are still required after reading both sides.
- Validate the merged branch before pushing.

## Test Plan

- Test Strategy Exception: this task is an integration merge, not a new behavior that can be meaningfully driven by RED-first tests. The validation gate is conflict-aware review plus the affected Moon tasks after the merge.
- After merging and resolving conflicts, run `git diff --check`, bridge-sdk validation, bridge-cli validation, and bridge-validator validation. Run Codex review again if conflict resolution changes source files materially.

## RED Evidence

- Not applicable; see Test Strategy Exception.

## GREEN Evidence

- `git merge origin/main` completed without conflicts.
- Reviewed the merge output: `main`'s one-based default V2 action start indexes, canonical empty action-list state, and actions API genesis before-state changes were preserved.
- `moon run bridge-sdk:test bridge-sdk:typecheck bridge-sdk:lint bridge-sdk:build bridge-cli:test bridge-cli:typecheck bridge-cli:lint bridge-cli:build bridge-validator:test bridge-validator:typecheck bridge-validator:lint bridge-validator:build actions-api:test actions-api:typecheck actions-api:lint actions-api:build -f` passed.
