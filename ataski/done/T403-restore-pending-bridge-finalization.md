---
id: T403
title: "Restore pending bridge finalization"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T00:00:00Z
updated_at: 2026-06-19T04:54:00Z
---

## Requirements

- Restore the pre-finality-aware runtime behavior where bridge finalization code can use pending indexed Actions API rows for deposit and withdrawal finalization witnesses.
- Do not remove finality metadata from Actions API responses.
- Do not regress the UI/status safety fixes for repeated same-aux withdrawals and provisional withdrawal status.
- Keep canonical-only semantics available for status consumers that need finality evidence, but finalization witness construction must not force a 290 L1-block canonical wait.
- Add tests that prove pending rows remain visible to finalization-oriented Actions API query surfaces while finality metadata still identifies them as pending.
- Keep the change surgical to Actions API query semantics and SDK tests unless code tracing proves an SDK call-site split is required.

## Test Plan

- TDD.
- RED: add/adjust Actions API tests proving pending outer witnesses, pending inner witnesses/action ranges, and pending commit anchors are available where finalization requires pending-inclusive rows.
- RED: run the focused Actions API test command and record the failing assertions before implementation.
- GREEN: adjust query predicates or query split so finalization paths can use pending rows again while status metadata remains present.
- GREEN: run focused Actions API tests and bridge SDK tests, then typecheck affected projects.

## RED Evidence

- `ACTIONS_API_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/actions" pnpm exec vitest run --config vitest.node.config.ts tests/actions.test.ts` failed before implementation with 4 assertion failures:
  - `queryOuterWitnessesFromAuxes` returned only canonical `a2`, not pending `a4-pending`.
  - `queryInnerWitnessesFromAuxes` returned only canonical `i1`, not pending `i2-pending`.
  - `queryInnerActions({ beforeState: "i1" })` returned `[]`, not pending `i2-pending`.
  - `queryCommitAsePastSlot(30)` anchored on canonical `a3`, not pending `a5-pending-commit`.

## GREEN Evidence

- `ACTIONS_API_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/actions" pnpm exec vitest run --config vitest.node.config.ts tests/actions.test.ts` passed with 14 tests after removing canonical-only filters.
- `moon run actions-api:manual-db-test -f` passed after widening the local Postgres healthcheck startup window; before that, the task failed before Vitest because Docker reported the Supabase Postgres container unhealthy during first boot.
- `moon run actions-api:typecheck -f` passed.
- `moon run bridge-sdk:test -f` passed: 14 files, 63 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run actions-api:lint -f` passed.
- `git diff --check` passed.
