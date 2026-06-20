---
id: T404
title: "Merge main after finality hotfix"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-20T04:34:17Z
updated_at: 2026-06-20T04:34:17Z
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
