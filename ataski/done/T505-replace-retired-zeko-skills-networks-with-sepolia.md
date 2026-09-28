---
id: T505
title: "Replace retired Zeko Skills networks with Sepolia"
status: done
blockedBy: []
owner: main
created_at: 2026-09-25T00:00:00Z
updated_at: 2026-09-25T12:32:00Z
---
## Requirements

- Remove retired Alphanet, testnet, and mainnet network declarations from the Zeko Skills package's active endpoint validation configuration.
- Configure endpoint validation for the retained Sepolia Zeko gateway, archive, and Actions API endpoints using the current documented/deployed Sepolia hostnames.
- Update package network documentation and tests where needed so the skill does not direct users to decommissioned networks as current configuration.
- Keep unrelated repository infrastructure and the user's untracked `decommission-evidence/` untouched.

## Test Plan

- **TDD:** First run the existing `zeko-skills:check` to capture the RED failure caused by stale endpoint configuration. Add/update focused tests asserting endpoint checks target only the retained Sepolia endpoints and their documented/deployed sources. Re-run focused tests and the full package check for GREEN.

## RED Evidence

- `./packages/zeko-skills/node_modules/.bin/vitest run packages/zeko-skills/tests/spec-and-utils.test.ts` — failed as expected: endpoint configuration had nine entries (legacy testnet/devnet/mainnet and faucet) instead of the required Sepolia service set, and retired mainnet/testnet URLs remained in the skipped-link list.
- Standard Moon invocation was unavailable in this environment (`moon: command not found`; `pnpm: command not found`).

## GREEN Evidence

- `./packages/zeko-skills/node_modules/.bin/vitest run packages/zeko-skills/tests` — passed, 22 tests.
- `./packages/zeko-skills/node_modules/.bin/tsgo --noEmit --declaration false --declarationMap false -p packages/zeko-skills/tsconfig.json` — passed.
- `./packages/zeko-skills/node_modules/.bin/tsgo -p packages/zeko-skills/tsconfig.build.json` — passed.
- Built `validateEndpoints()` directly from `packages/zeko-skills/dist/validation/endpoints.js` — passed against Sepolia documentation/deployment sources.
- `node packages/zeko-skills/dist/cli.js validate` — endpoint checks passed, but full link validation is blocked by unavailable external DNS/request (`skills.sh/docs` timed out). Standard `moon`/`pnpm` commands are unavailable in this environment.
