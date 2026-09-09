---
id: T498
title: "Make Actions Dashboard Sepolia-only"
status: done
blockedBy: []
owner: codex
created_at: 2026-09-09T09:10:00Z
updated_at: 2026-09-09T09:30:00Z
---
## Requirements

- Remove all mainnet/testnet runtime logic from `apps/actions-dashboard/`.
- Keep only the Sepolia network model, endpoints, selector, environment overrides, token name, deployment variables, documentation, and tests.
- Preserve the explicit unsupported Sepolia L1 daemon behavior.
- Do not modify unrelated files outside `apps/actions-dashboard/`, except the Ataski task board.
- Do not deploy live infrastructure.

## Test Plan

- Strategy: BDD.
- RED: record the existing dashboard test pass and forbidden mainnet/testnet references before narrowing the dashboard; update focused behavior/config tests to assert Sepolia-only resolution and run them before implementation.
- GREEN: remove the obsolete network branches and run dashboard tests, lint, diff checks, and Wrangler dry-run validation.

## RED Evidence

- Baseline dashboard tests passed, but `apps/actions-dashboard/` contained mainnet/testnet network types, selectors, defaults, environment variables, token documentation, and test fixtures; the requested Sepolia-only invariant was not satisfied.

## GREEN Evidence

- `rg -n -i --glob '!node_modules/**' --glob '!*.map' --glob '!.nuxt/**' --glob '!.output/**' 'mainnet|testnet' apps/actions-dashboard` returned no matches.
- `node_modules/.bin/moon run actions-dashboard:test -f` passed: 39 tests.
- `node_modules/.bin/moon run actions-dashboard:lint -f` passed.
- `cd apps/actions-dashboard && ./node_modules/.bin/wrangler deploy --dry-run --config wrangler.jsonc` passed and listed only Sepolia environment bindings.
- `git diff --check` passed.
- `node_modules/.bin/moon run actions-dashboard:typecheck -f` remains blocked by the pre-existing missing `node:path` and `node:url` declarations in `nuxt.config.ts`; no dashboard source type errors were reported.
