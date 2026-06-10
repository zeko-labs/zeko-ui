---
id: T288
title: "Enable bridge validator cron"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T07:08:44Z
updated_at: 2026-06-10T07:20:00Z
---

## Requirements

- Enable scheduled bridge validator runs in Cloudflare configuration.
- Set the validator cron cadence to every 3 hours.
- Keep the schedule configurable from Wrangler config without test, docs, or generated type assertions that lock in a specific cron string.
- Verify manual/admin HTTP surfaces are protected by `VALIDATOR_API_TOKEN`.
- Keep `.env.example` authoritative for validator env keys and avoid leaking token values.

## Test Plan

- BDD. Update the Worker metadata/auth tests so they describe the contract without asserting a fixed schedule string, and add coverage that admin HTTP routes reject unauthenticated requests.
- Run `moon run bridge-validator:type-cf -f`, `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, `moon run bridge-validator:build -f`, and `git diff --check`.

## RED Evidence

- `wrangler.jsonc` still had scheduled runs disabled and the previous validator cadence.
- `service-info.ts` and `tests/index.test.ts` hard-coded the old cron string.

## GREEN Evidence

- Enabled scheduled runs with `BRIDGE_VALIDATOR_ENABLED=true` in `wrangler.jsonc`.
- Set the Cloudflare cron source of truth to `0 */3 * * *` in `wrangler.jsonc`.
- Updated route alternation to use a 3 hour interval so adjacent scheduled runs alternate deposit and withdrawal.
- Removed the hard-coded cron string from service metadata and tests; the only cron literal left is the actual Wrangler trigger config.
- Added Worker-level auth coverage proving unauthenticated root, `/bridge-start`, `/bridge-status`, and `/bridge-cleanup` requests return 401 before route handling.
- `moon run bridge-validator:type-cf -f`: passed and regenerated Worker types.
- `moon run bridge-validator:test -f`: 4 files passed, 37 tests passed.
- `moon run bridge-validator:typecheck -f`: passed.
- `moon run bridge-validator:lint -f`: passed.
- `moon run bridge-validator:build -f`: passed with the existing `tsdown` `resolve.tsconfigFilename` deprecation warning.
- `git diff --check`: passed.
- Secret/path scan found no user-local path or real token-looking value in the changed validator files; only the fake test literal `validator-token` remains.
