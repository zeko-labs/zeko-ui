---
id: T095
title: "Validate and resolve PR 139 review comments"
status: in-progress
blockedBy: [T094]
owner: codex
created_at: 2026-03-12T15:40:00Z
updated_at: 2026-03-12T15:55:00Z
---

## Requirements

- Pull all active GitHub review threads for PR #139 after the validator scope split is complete.
- For each review comment, verify whether the finding is real against the current code rather than applying suggestions blindly.
- Fix every legitimate finding on the canonical branch with tests where behavior changes.
- Resolve each GitHub conversation appropriately:
  - fix + resolve for legitimate findings
  - resolve as outdated when the comment no longer applies after later changes
  - leave a concise explanation only when a finding is not valid
- Record the review-thread outcomes and validation evidence in GREEN evidence.

## Test Plan

- DDD. First enumerate all live review threads and classify them as valid, outdated, or invalid against the current tree.
- For valid findings, reproduce with focused tests or concrete code-path inspection before changing code.
- Re-run the affected package gates after fixes, then resolve the corresponding GitHub threads.

## RED Evidence

- `gh api graphql ... pullRequest(number:139) { reviewThreads { ... } }` returns multiple unresolved review threads on PR #139 across `bridge-cli`, `bridge-sdk`, and related files.
- Current unresolved thread set includes:
  - valid-looking behavioral findings around recipient handling, finalization account selection, GraphQL error swallowing, and submit-state failure transitions
  - style/refactor suggestions that need validation against the current branch before changing code

## GREEN Evidence
