---
id: T013
title: "Harden faucet claim paths and locking"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-28T09:11:56Z
updated_at: 2026-02-28T15:46:53Z
---

Implement the faucet worker hardening plan:

- keep the public claim API GitHub-PAT only
- move the turnstile flow to an internal Worker RPC path
- guard claim issuance with short-lived Durable Object mutexes
- preserve browser-facing UI messages and response envelopes
- keep the CLI package decoupled from internal transport details

## RED Evidence

- `packages/faucet-cli/node_modules/.bin/vitest run apps/faucet/test/worker.test.ts packages/faucet-cli/test/api.test.ts --coverage=false`
- Failing expectations captured the intended boundary changes before implementation:
  - public `turnstile` requests returned `500`/`400` instead of the planned `400 invalid_auth_method`
  - `TurnstileClaimsEntrypoint` was not exported (`TypeError: TurnstileClaimsEntrypoint is not a constructor`)
  - `ClaimMutex` was not exported (`TypeError: ClaimMutex is not a constructor`)
  - GitHub `403 x-ratelimit-remaining=0` returned `400` instead of `429 github_rate_limited`
  - the CLI still sent `X-Auth-Method: github`

## GREEN Evidence

- `packages/faucet-cli/node_modules/.bin/vitest run apps/faucet/test/worker.test.ts packages/faucet-cli/test/api.test.ts --coverage=false`
  - Passed with 19/19 tests, covering the HTTP-vs-RPC boundary, mutex lease expiry, GitHub rate-limit mapping, and CLI public API behavior.
- `moon faucet:type-cf`
  - Passed and regenerated `apps/faucet/worker-configuration.d.ts` with `ClaimMutex` bindings.
- `moon faucet-ui:type-cf`
  - Passed and regenerated `apps/faucet-ui/worker-configuration.d.ts`.
- `moon -u faucet:typecheck`
  - Passed.
- `moon -u faucet-ui:build`
  - Passed, confirming the new RPC call site compiles in the real app bundle.
- `moon -u faucet-cli:test`
  - Passed with 33/33 tests.
- `moon -u faucet-cli:typecheck`
  - Passed.
- `pnpm exec biome check --formatter-enabled=false apps/faucet/worker.ts apps/faucet/src/index.ts apps/faucet/test/worker.test.ts apps/faucet-ui/server/api/faucet.post.ts packages/faucet-cli/src/api.ts packages/faucet-cli/test/api.test.ts`
  - Passed.
