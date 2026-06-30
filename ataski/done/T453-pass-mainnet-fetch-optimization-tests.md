---
id: T453
title: "Pass mainnet fetch optimization tests"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-30T08:41:14Z
updated_at: 2026-06-30T08:44:17Z
---

## Requirements

- Make the current `add-mainnet-fetch-optimization` branch pass the relevant bridge SDK automated tests.
- Update stale bridge SDK test expectations only where the committed branch behavior has intentionally changed.
- Remove unresolved conflict markers from bridge SDK example files before committing.
- Do not include unrelated local scratch files in the commit.

## Test Plan

- TDD
- RED: run `pnpm exec moon run bridge-sdk:test -f` before source edits and record the failing assertion.
- GREEN: rerun `pnpm exec moon run bridge-sdk:test -f` after the focused fixes.

## RED Evidence

- `pnpm exec moon run bridge-sdk:test -f` failed in `test/network-history-constants.test.ts`: expected `getBridgeDeployBlock("mainnet")` to be `0`, received `530000`.

## GREEN Evidence

- `rg -n '^<<<<<<<|^=======|^>>>>>>>' packages/bridge-sdk ataski || true` returned no conflict markers.
- `pnpm exec moon run bridge-sdk:test -f` passed: 16 test files, 72 tests.
- `pnpm exec moon run bridge-sdk:typecheck -f` passed.
- Final rerun after the immutable timestamp cleanup: `pnpm exec moon run bridge-sdk:test -f` passed, 16 test files and 72 tests.
