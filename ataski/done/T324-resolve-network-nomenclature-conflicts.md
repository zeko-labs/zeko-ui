---
id: T324
title: "resolve network nomenclature conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-15T10:07:03Z
updated_at: 2026-06-15T10:09:03Z
---

## Requirements

- Bring `branch/zeko-network-nomenclature` up to date with `origin/main`.
- Resolve merge conflicts without dropping the network nomenclature, faucet legacy removal, monorepo sync, or `tsgo` changes already on this branch.
- Keep Ataski task records consistent and commit/push the conflict resolution back to the PR branch.

## Test Plan

- BDD: use the merge conflict state as RED evidence, then validate the resolved branch with focused tests for the touched faucet and sync behavior plus relevant typechecks.

## RED Evidence

- `git merge origin/main` failed with a content conflict in `packages/zeko-skills/zeko/references/30-bridge-and-faucet.md`.

## GREEN Evidence

- Resolved `packages/zeko-skills/zeko/references/30-bridge-and-faucet.md` by keeping main's high-level Bridge CLI guidance and this branch's `zeko-m:testnet` nomenclature.
- Corrected the auto-merged `packages/bridge-cli/AGENTS.md` route examples from `zeko:testnet` to `zeko-m:testnet`.
- `pnpm exec moon run zeko-skills:test -f -- --run tests/mirror-sync.test.ts` passed.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts tests/routes.test.ts` passed.
- `git diff --check` passed.
