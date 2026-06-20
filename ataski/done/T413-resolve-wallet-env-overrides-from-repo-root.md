---
id: T413
title: "Resolve wallet env overrides from repo root"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T21:01:43Z
updated_at: 2026-06-19T21:04:31Z
---

## Requirements

- Fix `services/bridge-validator/scripts/sync-secrets.nu` so relative `BRIDGE_VALIDATOR_WALLET_ENV_FILE` values loaded from the root `.env` resolve relative to that `.env` file, not the process current working directory.
- Preserve existing behavior for absolute override paths and shell-provided overrides.
- Keep repo-root wallet files usable from Moon task execution where the process cwd may be `services/bridge-validator`.

## Test Plan

- TDD: add a failing process-level test in `services/bridge-validator/tests/secret-sync-script.test.ts` where the dotenv file sets `BRIDGE_VALIDATOR_WALLET_ENV_FILE=.env.wallet.validator`, the wallet file exists beside that dotenv file, and the script is executed from `services/bridge-validator`. RED should fail because the current script resolves the override from the process cwd.
- GREEN: update path resolution and rerun the focused secret sync tests, then rerun affected validator checks.

## RED Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` failed as expected with 1 failing test: `resolves dotenv wallet env overrides relative to the dotenv file`. The script tried to read `services/bridge-validator/.env.wallet.validator` instead of the wallet file beside the provided dotenv file.

## GREEN Evidence

- `moon run bridge-validator:test -f -- tests/secret-sync-script.test.ts` passed with 6 tests.
- `moon run bridge-validator:test bridge-validator:typecheck bridge-validator:lint bridge-validator:build -f` passed with 42 tests plus typecheck, lint, and build.
- `git diff --check` passed.
