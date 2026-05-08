---
id: T179
title: "Show queued bridge operation hash"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-07T00:22:51Z
updated_at: 2026-05-07T00:31:55Z
---

## Requirements

- Show the transaction hash on queued bridge operation cards when the operation has a persisted transaction hash.
- Keep the queued card compact and avoid layout shifts for long hashes.
- Preserve the existing queued operation status, direction, and amount display.

## Test Plan

- DDD: add the display using existing operation context data and validate with bridge UI typecheck, lint, and unit tests.

## RED Evidence

- Manual report: queued transactions could not be distinguished, making it unclear whether the same transaction was being finalized repeatedly.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/bridge-view-model.test.ts test/unit/bridge-operation.test.ts` passed (8 tests).
- `moon run bridge-ui:test -f` passed (13 files, 61 tests).
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `git diff --check` passed.
