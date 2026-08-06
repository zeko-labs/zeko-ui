---
id: T495
title: "Add Sepolia Actions API environment and CORS policy"
status: done
blockedBy: []
owner: unassigned
created_at: 2026-08-05T00:00:00Z
updated_at: 2026-08-06T05:30:00Z
---

## Requirements

- Add an isolated `sepolia` Wrangler environment to `services/actions/api/wrangler.jsonc`.
- Configure the `sepolia.api.actions.zeko.io` custom domain, `ENVIRONMENT=sepolia`, and the dedicated cached/no-cache Hyperdrive IDs:
  - cached: `b87682614aa74131a3754b90fd1c815d`
  - no-cache: `7fb4470db72746ee8078f65bd031bb3c`
- Preserve existing mainnet and testnet Worker environments, routes, vars, bindings, and behavior.
- Configure production CORS for Sepolia to allow only `https://sepolia.bridge.zeko.io`; do not weaken existing environment behavior.
- Add meaningful tests proving Sepolia configuration/binding selection and CORS behavior, including rejection of non-Sepolia origins and regression coverage for mainnet/testnet configuration.
- Regenerate Cloudflare types through the project task; never edit `worker-configuration.d.ts` manually.
- Do not commit database credentials, control tokens, or other secrets.

## Test Plan

- Strategy: BDD.
- RED: add focused configuration and Worker request tests that fail because the `sepolia` environment and strict Sepolia CORS behavior are absent.
- GREEN: implement the Wrangler environment and environment-aware CORS, then run the focused tests plus API typecheck, lint, schema generation, and Cloudflare type generation.
- Live deployment and public endpoint checks are operator handoff steps after local GREEN validation; they must not be substituted for automated tests.

## RED Evidence

- `cd services/actions/api && node_modules/.bin/vitest run --config vitest.config.ts src/cors.test.ts tests/wrangler-config.test.ts` failed before implementation. The CORS test could not resolve the not-yet-created `src/cors.ts` module; the Wrangler config test also exposed that the worker-pool harness cannot read the repository config file directly. The config test will be isolated under a Node Vitest configuration before implementation validation.

## GREEN Evidence

- `cd services/actions/api && node_modules/.bin/vitest run --config vitest.unit.config.ts` passed: 4 tests.
- `cd services/actions/api && node_modules/.bin/biome check --formatter-enabled=false src/index.ts src/cors.ts tests/cors.test.ts tests/wrangler-config.test.ts vitest.unit.config.ts` passed.
- `cd services/actions/api && node_modules/.bin/wrangler types` passed and generated the Sepolia environment declaration.
- `cd services/actions/api && node_modules/.bin/tsgo --noEmit --declaration false --declarationMap false --lib esnext -p tsconfig.json` passed.
- `cd services/actions/api && node_modules/.bin/tsdown` passed.
- `cd services/actions/api && node_modules/.bin/wrangler deploy --dry-run --env sepolia` passed and listed both dedicated Hyperdrive bindings plus `ENVIRONMENT=sepolia`.
- The repository-default TypeScript check without `--lib esnext` still fails on the pre-existing `src/db.ts` `Symbol.dispose` error; the existing Bun schema generator was completed through a Node/tsx compatibility shim because Bun is unavailable in this shell.
- Live checks on 2026-08-06 passed: `/health` reported `healthy`, `environment: sepolia`, and database `up`; schema introspection returned `Query`; `outerWitnessesFromAuxes` returned an array; allowed CORS returned `https://sepolia.bridge.zeko.io`; an unexpected origin was not reflected.

## Completion Notes

Implemented and deployed the isolated Sepolia Actions API environment. Automated and live validation passed; the repository-default TypeScript command retains the unrelated `Symbol.dispose`/`lib: es2021` failure documented above.
