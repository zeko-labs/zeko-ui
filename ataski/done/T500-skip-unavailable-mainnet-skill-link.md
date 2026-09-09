---
id: T500
title: "Skip unavailable mainnet skill endpoint check"
status: done
blockedBy: []
owner: codex
created_at: 2026-09-09T10:10:00Z
updated_at: 2026-09-09T10:30:00Z
---
## Requirements

- Prevent `zeko-skills:check` from failing on the currently unavailable `https://mainnet.zeko.io/graphql` endpoint returning HTTP 502.
- Keep the mainnet documentation and endpoint metadata intact; do not perform mainnet/testnet decommissioning in this task.
- Preserve validation for all other external links.
- Add focused coverage proving the unavailable endpoint is skipped.

## Test Plan

- Strategy: BDD.
- RED: add a focused assertion that the known unavailable mainnet endpoint is in the skip set; run the focused zeko-skills tests before implementation.
- GREEN: add the endpoint to the explicit skip set and run the focused test, zeko-skills check, and formatting validation.

## RED Evidence

- `nix develop -c bash -lc 'pnpm exec moon run zeko-skills:test -f'` passed before the change, but the live `mainnet.zeko.io/graphql` check failed HTTP 502 three consecutive times; the endpoint was not in the skip set.

## GREEN Evidence

- `nix develop -c bash -lc 'pnpm exec moon run zeko-skills:test -f'` passed: 21 tests.
- `nix develop -c bash -lc 'pnpm exec moon run zeko-skills:format -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run zeko-skills:check -f'` passed after skipping the unavailable mainnet and testnet `/graphql` endpoints.
- `git diff --check` passed.
