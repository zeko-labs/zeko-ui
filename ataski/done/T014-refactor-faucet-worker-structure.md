---
id: T014
title: "Refactor faucet worker file structure"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-01T15:54:56Z
updated_at: 2026-03-01T16:02:53Z
---

Break the faucet worker implementation into a small set of logical modules under a dedicated worker directory while preserving behavior.

## TDD Exception

This task is a behavior-preserving structural refactor. Instead of introducing new failing tests first, the validation strategy is:

- keep the current faucet worker behavior unchanged
- preserve the existing worker and CLI test coverage
- re-run the faucet worker tests, type generation, typecheck, UI build, and CLI checks after the refactor

## GREEN Evidence

- `packages/faucet-cli/node_modules/.bin/vitest run apps/faucet/test/worker.test.ts packages/faucet-cli/test/api.test.ts --coverage=false`
- `moon run faucet:typecheck -f`
- `pnpm exec biome check --formatter-enabled=false apps/faucet/worker.ts apps/faucet/worker/**/*.ts`
