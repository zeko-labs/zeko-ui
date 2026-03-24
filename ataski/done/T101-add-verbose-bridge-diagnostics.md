---
id: T101
title: "Add verbose bridge diagnostics"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T10:53:00Z
updated_at: 2026-03-19T18:36:00Z
---

## Requirements

- In verbose bridge runs, report richer progress diagnostics for long waits instead of only phase-level heartbeats.
- Include per-operation timing and call counts for SDK-facing bridge adapter methods in the final result, and enough intermediate detail to understand where time is being spent while the command is still running.
- Surface the precise underlying SDK diagnostic reason when available, rather than collapsing capability checks into bare booleans.
- Keep non-verbose behavior compact.

## Test Plan

- DDD.
- RED path:
  - inspect the current verbose bridge output and final result shape
  - confirm that capability waits do not report per-method timings, call counts, or structured SDK reasons
- GREEN path:
  - add targeted tests for verbose diagnostics aggregation and output shaping
  - rerun `moon run bridge-cli:test`
  - verify a verbose bridge invocation now emits richer intermediate/final diagnostics without breaking existing non-verbose output

## RED Evidence

- The current bridge inspect loop reports only phase-level heartbeats and booleans from capability checks.
- `canFinalizeDeposit`, `canCancelDeposit`, and `canFinalizeWithdrawal` currently return `Promise<boolean>` through the adapter, so the CLI cannot tell the operator whether the underlying SDK reason is something like `No withdrawal witnesses found` or another more specific condition.
- The SDK already contains a diagnostics module with structured witness-match reasons, but the bridge CLI does not currently surface that information during verbose waits or in the final result.

## GREEN Evidence

- Added detailed capability methods in `packages/bridge-sdk/src/index.ts`:
  - `canFinalizeDepositDetailed`
  - `canCancelDepositDetailed`
  - `canFinalizeWithdrawalDetailed`
    These preserve the existing boolean methods while exposing the underlying SDK reason when capability is unavailable.
- Extended the bridge-cli adapter in `packages/bridge-cli/src/core/adapter.ts` to surface those detailed capability diagnostics.
- Instrumented `packages/bridge-cli/src/commands/bridge.ts` so verbose bridge runs now persist:
  - per-SDK-call traces
  - per-method aggregated stats
  - phase timings
  - latest wait reasons for capability checks
- Updated `packages/bridge-cli/src/core/reporter.ts` so verbose final results include `verbose_diagnostics` in JSON and a human-readable diagnostics section in terminal output, while non-verbose output stays compact.
- Added regression coverage:
  - `packages/bridge-cli/tests/bridge-flow.test.ts`
  - `packages/bridge-cli/tests/reporter.test.ts`
- Re-ran targeted verification:
  - `pnpm --dir packages/bridge-cli exec vitest run tests/reporter.test.ts tests/bridge-flow.test.ts tests/operation-command.test.ts --config vitest.config.ts`
  - `pnpm --dir packages/bridge-cli exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/bridge-sdk exec tsc -p tsconfig.json --noEmit`
- Re-ran broader verification:
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-cli:build`
  - `moon run docs:build`
