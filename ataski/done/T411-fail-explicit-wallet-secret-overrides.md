---
id: T411
title: "Fail explicit wallet secret overrides"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T16:24:13Z
updated_at: 2026-06-19T16:27:15Z
---

## Requirements

- Address Codex review finding P2 for `services/bridge-validator/scripts/sync-secrets.nu`.
- If `.env` sets `BRIDGE_VALIDATOR_WALLET_ENV_FILE`, the sync script must fail when that explicit file is missing instead of reading `{}` and falling back to legacy wallet keys from `.env`.
- Keep the default `.env.wallet.validator` behavior optional enough for the existing legacy fallback path.
- Keep the change limited to validator secret sync behavior and its focused tests.

## Test Plan

- TDD.
- Add a failing regression assertion to `services/bridge-validator/tests/secret-sync-script.test.ts` that proves the explicit override path is required and not passed through `read-optional-dotenv`.
- Run `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` to capture RED before implementation.
- Implement the smallest script change that makes explicit overrides fail fast while preserving default optional fallback.
- Rerun the focused validator test, then affected validator validation.

## RED Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` failed before implementation.
- Failing assertion: `fails when an explicit wallet env override points to a missing file` resolved successfully instead of rejecting.
- Observed stdout included `Cloudflare validator secrets synced from ... .env.wallet.missing`, proving explicit missing wallet overrides silently fell back to legacy `.env` wallet keys.

## GREEN Evidence

- Implemented `read-explicit-wallet-dotenv` in `services/bridge-validator/scripts/sync-secrets.nu` and used it only when `.env` sets `BRIDGE_VALIDATOR_WALLET_ENV_FILE`.
- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` passed: 4 tests.
- `moon run bridge-validator:test bridge-validator:typecheck bridge-validator:lint bridge-validator:build -f` passed: 40 validator tests, typecheck, Biome lint, and build.
- `git diff --check` passed.
