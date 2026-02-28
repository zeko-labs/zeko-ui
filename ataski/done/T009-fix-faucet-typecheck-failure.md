---
id: T009
title: "Fix faucet typecheck failure"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T09:52:27Z
updated_at: 2026-02-27T23:09:22Z
---

Investigate the failing faucet typecheck, identify the regression, and restore a clean typecheck result.

## RED Evidence

- `pnpm --filter faucet typecheck` failed
- pnpm reported that none of the selected packages has a `typecheck` script

## GREEN Evidence

- `pnpm --filter faucet typecheck` passed
- `moon -u faucet:typecheck` passed

## Correction

- The package-level `typecheck` interpretation was incorrect for this repo.
- Repository workflows must be run through `moon` from the repo root, and `package.json` scripts must not be added as alternative workflow entrypoints.
