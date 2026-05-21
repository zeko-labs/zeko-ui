---
id: T244
title: "correct-bridge-mainnet-config"
status: done
blockedBy: [T243]
owner: codex
created_at: 2026-05-21T07:51:03Z
updated_at: 2026-05-21T08:28:44Z
---

## Requirements

- Apply the minimal code/config/docs correction from the T243 audit.
- Do not enable `mina:mainnet <=> zeko:mainnet` as a working CLI route unless the Actions API/indexer dependency is proven mainnet-ready.
- If the route is not ready, keep it disabled and make the disabled reason specific enough for operators.
- Ensure SDK/example configuration can still express mainnet endpoints and network IDs without implying the full bridge route is operational.
- Preserve testnet defaults and existing testnet behavior.
- Add regression tests for the chosen route behavior and any SDK/example config fixes.
- Add a changeset only for publishable package behavior/doc changes.

## Test Plan

- TDD. First add/update tests that fail against the current code for the chosen correction, including explicit Actions API/mainnet route readiness behavior.
- GREEN should run focused bridge-cli and bridge-sdk tests, typechecks, and linters through Moon.
- Do not run manual live tests or transaction-submitting commands.

## RED Evidence

- In task worktree `ataski/worktrees/T244-correct-bridge-mainnet-config`, `moon run bridge-cli:test bridge-sdk:test` failed on `bridge-sdk:test` after adding config regression coverage:
  - `packages/bridge-sdk/test/config.test.ts` expected `Bridge.setL2()` to pass `archive: "http://l2-archive.test"` to `Mina.Network`, but current code passed `archive: "http://l2.test"`.
  - `packages/bridge-sdk/test/config.test.ts` expected SDK examples to accept `L1_NETWORK=mainnet` / `L2_NETWORK=mainnet`, but current helper returned hardcoded `testnet`.
  - `packages/bridge-sdk/test/config.test.ts` expected invalid example network IDs to throw, but current helper accepted them implicitly by ignoring the env value.
- In the same task worktree, targeted `pnpm exec vitest run tests/routes.test.ts` from `packages/bridge-cli` failed because the mainnet route reason was still the generic `Known route, not enabled yet.` instead of the Actions API/indexer readiness blocker.

## GREEN Evidence

- Merged task branch `task/T244-correct-bridge-mainnet-config` into canonical branch `branch/bridge-mainnet-readiness`.
- `moon run bridge-cli:test bridge-sdk:test` passed in the task worktree:
  - `bridge-sdk:test`: 8 files passed, 42 tests passed.
  - `bridge-cli:test`: 21 files passed, 105 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck bridge-sdk:typecheck bridge-cli:lint bridge-sdk:lint` passed in the task worktree. Existing `bridge-sdk:lint` warnings in `src/types.ts` were non-failing and unrelated to this change.
- Task commit `82e7643` was created with the repository pre-commit hook. The hook ran `pnpm exec moon run :lint-fix`, `pnpm exec moon run :format-all-fix`, and `pnpm exec moon run bridge-ui:typecheck` successfully.
- No manual live bridge tests, value-moving commands, or real mainnet transactions were run.
