---
id: T244
title: "Validate bridge SDK functional core refactor"
status: done
blockedBy: [T243]
owner: codex
created_at: 2026-05-08T20:55:07Z
updated_at: 2026-05-08T21:20:33Z
---

## Requirements

- Validate that the WEB-460 refactor remains behavior-compatible across bridge-sdk and affected consumers.
- Run the bridge-sdk test and typecheck tasks through Moon from the repository root.
- Run affected bridge CLI tests that exercise SDK calls and signing callbacks.
- Run affected bridge UI tests that exercise SDK worker signing integration.
- Fix any import/export, type, formatting, or consumer compatibility issues discovered by validation without changing public SDK behavior.
- Record final command evidence before moving the task to done.

## Test Plan

- DDD compatibility validation after T195 is complete.
- GREEN requires `moon run bridge-sdk:test -f`, `moon run bridge-sdk:typecheck -f`, and focused affected bridge CLI/UI tests to pass or have a documented external blocker.

## RED Evidence

- `moon run bridge-cli:test -f -- tests/direct-commands.test.ts tests/bridge-flow.test.ts` initially failed in `bridge-sdk:build` because new exported declarations were missing explicit return types under `--isolatedDeclarations`.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 5 files, 25 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed after adding explicit exported return types.
- `moon run bridge-cli:test -f -- tests/direct-commands.test.ts tests/bridge-flow.test.ts` passed: 2 files, 31 passed, 13 skipped.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/transaction-machine.test.ts` passed: 2 files, 11 tests.
- `moon run bridge-sdk:lint -f` passed with only the pre-existing `src/types.ts` `ExtractInput<any>` warnings.
