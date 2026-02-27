---
id: T009
title: "Fix faucet typecheck failure"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T09:52:27Z
updated_at: 2026-02-27T09:54:49Z
---

Investigate the failing faucet typecheck, identify the regression, and restore a clean typecheck result.

## RED Evidence

- `pnpm --filter faucet typecheck` failed
- pnpm reported that none of the selected packages has a `typecheck` script

## GREEN Evidence

- `pnpm --filter faucet typecheck` passed
- `moon -u faucet:typecheck` passed
