---
id: T243
title: "Refactor bridge SDK functional core"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T20:55:07Z
updated_at: 2026-05-08T21:16:21Z
---

## Requirements

- Resolve Linear issue WEB-460 by refactoring `packages/bridge-sdk/src/index.ts` into a thin public `Bridge` facade over focused functional modules.
- Preserve public SDK behavior: method names, signatures, return shapes, exports, retry defaults, polling semantics, fee behavior, and wallet signing callback behavior must remain compatible.
- Introduce a runtime/config module that owns GraphQL clients, config, bridge public keys, holders, fees, sequencer key, and withdrawal delay.
- Extract shared infrastructure for Mina network selection, account reads, current slot calculation, proving-result polling, and signed transaction helper extraction.
- Extract deposit modules for history decoding, deposit state context, state derivation, finalization/cancellation witness selection, and deposit transaction construction/submission.
- Extract withdrawal modules for history decoding, state projection, finalization witness selection, and withdrawal transaction construction/submission.
- Do not introduce a generic operation pipeline, new runtime dependency, or intentional protocol behavior change.

## Test Plan

- DDD: this is a structure-preserving protocol refactor. Before source edits, use the existing bridge-sdk tests as characterization coverage and record their current status as RED/baseline evidence.
- During extraction, preserve existing domain invariants for deposit cancellation, deposit finalised state, withdrawal finalization state, fee payout handling, helper account signature extraction, and signing callback boundaries.
- GREEN requires the focused bridge-sdk tests that cover existing protocol behavior to pass after the refactor; broader compatibility validation is tracked in T196.

## RED Evidence

- `moon run bridge-sdk:test -f` initially failed before tests in the fresh worktree because `tsdown` was not installed for `graphql:build`.
- After `pnpm i`, `moon run bridge-sdk:test -f` passed as baseline characterization: 5 files, 25 tests.

## GREEN Evidence

- `moon run bridge-sdk:typecheck -f` passed after extracting the functional core modules.
- `moon run bridge-sdk:test -f` passed after the refactor: 5 files, 25 tests.
