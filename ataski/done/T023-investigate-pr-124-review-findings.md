---
id: T023
title: "Investigate PR 124 review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-02T12:28:09Z
updated_at: 2026-03-02T12:35:02Z
---

## Scope

Validate the reported review findings for PR #124 and fix the real issues.

## TDD Exception

This task starts with validation of reported review findings across existing code, Moon task wiring, and tracker files. The first step is to confirm which findings reproduce in the current tree, then apply targeted fixes and validate with the relevant Moon and test commands.

## Validation

Real issues confirmed:

- `apps/faucet/moon.yml` did not define a project `test` task, so `moon faucet:test` inherited the workspace default no-op task.
- `apps/faucet/worker/claim-service.ts` and `packages/faucet-cli/src/validation.rs` only enforced alphanumeric addresses, not Mina public-key format.

Reported issues not reproduced:

- Internal Turnstile RPC rate limiting is present via `enforceIpPolicies(...)` in `TurnstileClaimsEntrypoint.claimWithTurnstile`.
- Worker and CLI response types already align on both `chain` and `explorer_url`.
- Duplicate `T002`/`T003`/`T004` Ataski task files were not present in the canonical board.

## GREEN Evidence

- `moon run faucet:typecheck -f` passed.
- `moon run faucet:test -f` passed (`21` tests).
- `moon run faucet-cli:test -f` passed (`10` tests).
