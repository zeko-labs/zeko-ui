---
id: T161
title: "Merge main and reapply faucet type refactor"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-29T11:44:01Z
updated_at: 2026-03-29T11:51:52Z
---

## Requirements

- Merge `origin/main` into the canonical faucet fix worktree branch and reconcile the already-merged PR changes with the local workstream.
- Keep the runtime fix from the merged mainline implementation and reapply only the type-system improvements that still add value on top.
- Preserve the committed-type workflow for Cloudflare type generation and keep the final code minimal.
- Validate the final merged state with focused faucet and faucet-ui checks.

## Test Plan

- DDD: inspect the dirty local diff and incoming `origin/main` changes first, merge mainline, then run focused typecheck, test, and build tasks after reconciling conflicts.

## RED Evidence

- The current canonical worktree is ahead with an uncommitted local diff based on pre-merge code.
- PR #161 is already merged on `origin/main`, so the local implementation must be rebased onto that newer source state instead of continuing from stale files.

## GREEN Evidence

- Merged `origin/main` into `branch/faucet-claim-502-fix`, which fast-forwarded the worktree to commit `1984ffa` (`fix: add rpc endpoint for zeko-ui (#161)`).
- Reapplied the surviving type-system improvements on top of the merged runtime fix: multi-config `wrangler types`, committed-type workflow in `faucet-ui`, removal of handwritten UI RPC binding types, faucet worker env/cast cleanup, and a faucet-only generated-env compatibility assertion.
- Validation passed with `pnpm install`, `pnpm exec moon run faucet-ui:type-cf -f`, `pnpm exec moon run faucet:typecheck -f`, `pnpm exec moon run faucet-ui:typecheck -f`, `pnpm exec moon run faucet-ui:test -f`, and `pnpm exec moon run faucet-ui:build -f`.
