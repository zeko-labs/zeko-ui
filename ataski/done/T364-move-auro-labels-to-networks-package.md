---
id: T364
title: "Move Auro labels to networks package"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T11:10:01Z
updated_at: 2026-06-17T11:11:29Z
---

## Requirements

- Define Auro wallet network ids and user-facing labels in `@zeko/networks`, not in `@zeko/sdk`.
- Keep `@zeko/sdk` behavior and public exports compatible by importing/re-exporting the network constants from `@zeko/networks`.
- Preserve the rule that Zeko display names come from the shared user-facing helper/labels.

## Test Plan

- TDD. First update package tests to expect `@zeko/networks` to own the Auro wallet network map and labels.
- GREEN path: move constants, update SDK imports/re-exports, run focused `networks` and `sdk` tests.

## RED Evidence

- `moon run networks:test -f -- nomenclature.test.ts && moon run sdk:test -f -- wallet.test.ts` failed as expected because `AURO_NETWORKS` was not exported from `@zeko/networks`.

## GREEN Evidence

- `moon run networks:test -f -- nomenclature.test.ts` passed: 1 file, 11 tests.
- `moon run sdk:test -f -- wallet.test.ts` passed: 1 file, 4 tests.
- `moon run networks:typecheck -f` passed.
- `moon run sdk:typecheck -f` passed.
- `moon run networks:lint -f` passed.
- `moon run sdk:lint -f` passed after removing a stale SDK import from the move.
- `moon run networks:build -f` passed.
- `moon run sdk:build -f` passed.
- No changeset was added because `@zeko/networks` and `@zeko/sdk` are currently private packages.
