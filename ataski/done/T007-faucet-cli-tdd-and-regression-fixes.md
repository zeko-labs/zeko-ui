---
id: T007
title: "Faucet CLI TDD and regression fixes"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-27T08:30:00Z
updated_at: 2026-02-27T08:43:07Z
---

Add full TDD coverage for `packages/faucet-cli` and fix the faucet regressions found in review.

## RED Evidence

- `moon faucet-cli:test` failed
- Reproduced regression: `claimFaucet > accepts successful faucet responses with a string amount`
- Failure: `CliError: The faucet service returned an unexpected response.`

## GREEN Evidence

- `moon faucet-cli:test` passed (`4` files, `33` tests)
- `moon faucet-cli:lint` passed
- `moon faucet-cli:typecheck` passed
- `pnpm --filter faucet test -- --run test/worker.test.ts` passed (`3` files, `17` tests)
- `moon faucet:type-cf` passed and regenerated `apps/faucet/worker-configuration.d.ts`
