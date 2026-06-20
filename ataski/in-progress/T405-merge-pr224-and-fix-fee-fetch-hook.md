---
id: T405
title: "Merge PR 224 and fix fee fetch hook"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-20T05:17:23Z
updated_at: 2026-06-20T05:17:23Z
---

## Requirements

- Merge the latest `origin/main` after PR #224 landed into `branch/bridge-finality-hotfix`.
- Preserve PR #224's generalized bridge transfer fee model as the source of truth.
- Resolve WEB-495 by ensuring submit-time bridge transfer fee guards in the SDK use the same account fetch hook as the rest of the bridge runtime: `runtime.bridge?.fetchAccount ?? fetchAccount`.
- Keep existing #220 CLI/debugging/runbook changes unless directly superseded by PR #224.
- Validate the affected bridge SDK and CLI surfaces before pushing PR #220.

## Test Plan

- TDD.
- RED: add focused bridge-sdk tests proving `submitDeposit` and `submitWithdrawal` call the runtime bridge account-fetch hook for recipient and helper account existence checks when calculating transfer fee requirements.
- GREEN: route the new fee guard account lookups through the runtime hook and run bridge-sdk plus bridge-cli validation.

## RED Evidence

## GREEN Evidence
