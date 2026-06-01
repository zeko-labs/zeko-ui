---
id: T269
title: "Fix Northflank release description"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T03:17:03Z
updated_at: 2026-05-27T03:19:40Z
---

## Requirements

- Update the mainnet release workflow and Northflank helper so the release-flow `description` satisfies Northflank's accepted character set.
- Preserve the same release-flow endpoint, name, overrides, branch, and SHA behavior.
- Update the mainnet readiness plan example so reviewers do not copy the rejected `@` description form.

## Test Plan

- DDD: this is driven by the observed Northflank API rejection during the live mainnet release.
- RED path: triggering the release flow with `description` set to `Triggered by zeko-labs/zeko-ui@<sha>` failed because Northflank rejected `@`.
- GREEN path: run formatting and dry-run the helper to confirm it emits a description using `sha` while keeping the same branch/SHA override structure.

## RED Evidence

- The first scripted Northflank release-flow trigger failed with a validation error for the `description` field when it contained `@`.

## GREEN Evidence

- Updated `.github/workflows/bridge-mainnet-release.yaml`, `scripts/mainnet-readiness/plan-northflank-mainnet.nu`, and `docs/BRIDGE_MAINNET_READINESS_PLAN.md` to use `description` text with `sha` instead of `@`.
- Dry-ran `scripts/mainnet-readiness/plan-northflank-mainnet.nu` with dummy non-secret inputs and confirmed the generated release-flow payload uses `Triggered by zeko-labs/zeko-ui sha 7dae5e173300c0462b60c291e9ecf907458710cb`.
- `moon run bridge-mainnet-readiness-plan:format -f` passed.
