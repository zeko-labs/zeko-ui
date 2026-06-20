---
id: T414
title: "Treat wallet env files as keypairs"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T21:17:14Z
updated_at: 2026-06-19T21:19:12Z
---

## Requirements

- Fix `services/bridge-validator/scripts/sync-secrets.nu` so a selected or present wallet env file is treated as an atomic keypair.
- If a wallet env file is explicit or exists at the default path, require both `MINA_PRIVATE_KEY` and `PUBLIC_KEY` from that file.
- Do not fall back to legacy `.env` wallet values for one missing field after any wallet file has been selected or found.
- Preserve legacy fallback only when no wallet env file is selected and no default wallet env file exists.

## Test Plan

- TDD: add a failing process-level test in `services/bridge-validator/tests/secret-sync-script.test.ts` where `.env` selects `.env.wallet.validator`, the wallet file contains only `MINA_PRIVATE_KEY`, and legacy `.env` contains both old wallet keys. RED should fail because the current script succeeds by mixing file and legacy values.
- GREEN: update keypair resolution to require both wallet file values together, then rerun focused and affected validator checks.

## RED Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` failed as expected with 1 failing test: `fails when a selected wallet env file is missing part of the keypair`. The command resolved successfully and synced mixed wallet secrets instead of rejecting the partial wallet file.

## GREEN Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` passed with 7 tests.
- `moon run bridge-validator:test bridge-validator:typecheck bridge-validator:lint bridge-validator:build -f` passed with 43 tests plus typecheck, lint, and build.
- `git diff --check` passed.
