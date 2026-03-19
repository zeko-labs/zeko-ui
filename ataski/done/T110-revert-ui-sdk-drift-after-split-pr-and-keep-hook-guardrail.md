---
id: T110
title: "Revert UI SDK drift after split PR and keep hook guardrail"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T21:45:00Z
updated_at: 2026-03-19T22:05:00Z
---

## Requirements

- Revert the post-split `apps/bridge-ui` and `packages/bridge-sdk` source drift back to `origin/main`.
- Keep the repo-level guardrail that makes pre-commit run bridge UI typechecking.
- Leave the canonical branch aligned with `main` for the already-split UI/SDK code.
- Run the relevant verification, then commit and push the cleanup.

## Test Plan

- Confirm the unwanted UI/SDK source edits are reverted to match `origin/main`.
- Verify the repo hook runs `bridge-ui:typecheck`.
- Run bridge UI typecheck and test coverage after the reversion.

## RED Evidence

- I incorrectly kept editing `apps/bridge-ui` and `packages/bridge-sdk` after the split PR had already merged those packages into `main`.
- Those source changes did not belong on the canonical bridge-cli branch because `main` was already the authoritative version for UI/SDK.

## GREEN Evidence

- Reverted `apps/bridge-ui/machines/bridgeOperation.ts`, `apps/bridge-ui/machines/operations.worker.ts`, `apps/bridge-ui/test/unit/bridge-operation.test.ts`, `packages/bridge-sdk/src/errors.ts`, and `packages/bridge-sdk/src/index.ts` back to `origin/main`.
- Kept the repo-level pre-commit addition in `lefthook.yaml` so staged changes run `pnpm exec moon run bridge-ui:typecheck`.
- Validation passed:
  - `pnpm exec moon run bridge-ui:typecheck bridge-ui:test`
  - `pnpm exec lefthook run pre-commit`
