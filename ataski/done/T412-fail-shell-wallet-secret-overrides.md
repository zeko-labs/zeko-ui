---
id: T412
title: "Fail shell wallet secret overrides"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T20:48:13Z
updated_at: 2026-06-19T20:49:44Z
---

## Requirements

- Address Codex review finding P2 for `services/bridge-validator/scripts/sync-secrets.nu`.
- If the shell environment sets `BRIDGE_VALIDATOR_WALLET_ENV_FILE`, the sync script must fail when that explicit file is missing instead of reading `{}` and falling back to legacy wallet keys from `.env`.
- Preserve the existing precedence where a `.env` `BRIDGE_VALIDATOR_WALLET_ENV_FILE` value selects the wallet file over the shell default helper path.
- Keep default `.env.wallet.validator` behavior optional enough for the existing legacy fallback path.

## Test Plan

- TDD.
- Add a failing regression assertion to `services/bridge-validator/tests/secret-sync-script.test.ts` that runs `scripts/sync-secrets.nu` with `BRIDGE_VALIDATOR_WALLET_ENV_FILE` set only in the process environment, pointing at a missing file, while legacy wallet keys exist in `.env`.
- Run `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` to capture RED before implementation.
- Implement the smallest script change that treats either `.env` or shell wallet overrides as explicit.
- Rerun focused validator tests, affected validator validation, and Codex review.

## RED Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` failed before implementation.
- Failing assertion: `fails when a shell wallet env override points to a missing file` resolved successfully instead of rejecting.
- Observed stdout included `Cloudflare validator secrets synced from ... .env.wallet.missing`, proving shell `BRIDGE_VALIDATOR_WALLET_ENV_FILE` still silently fell back to legacy `.env` wallet keys.

## GREEN Evidence

- Implemented explicit override detection for both `.env` and shell `BRIDGE_VALIDATOR_WALLET_ENV_FILE` sources in `services/bridge-validator/scripts/sync-secrets.nu`.
- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` passed: 5 tests.
- `moon run bridge-validator:test bridge-validator:typecheck bridge-validator:lint bridge-validator:build -f` passed: 41 validator tests, typecheck, Biome lint, and build.
- `git diff --check` passed.
