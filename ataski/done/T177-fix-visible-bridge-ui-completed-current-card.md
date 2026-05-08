---
id: T177
title: "Fix visible bridge UI completed current card"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-07T00:03:50Z
updated_at: 2026-05-07T00:08:24Z
---

## Requirements

- After a user finalizes a bridge transaction, the main bridge card must not keep rendering that completed operation.
- The current card must return to the input form when there is no queued operation.
- When a queued operation exists, the bridge parent must resume/select it so the current card advances.
- A completed actor snapshot must not be enough to keep the disabled Claim button/progress bar visible in the active area.
- Keep completed operations visible in the completed transactions list.

## Test Plan

- BDD: add failing view-model coverage for the real visible state: an active operation whose actor snapshot is already completed must not be selected as current.
- BDD: add/adjust bridge machine coverage so parent completion changes the active operation, not just emits an event.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/bridge-view-model.test.ts` failed on `does not keep a completed actor snapshot in the current operation slot`: the selector returned the completed actor as `currentOperation`, matching the visible stuck card with completed status, finalizing progress, and disabled Claim button.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/bridge-view-model.test.ts` passed (3 tests).
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts` passed (5 tests).
- `moon run bridge-ui:test -f` passed (13 files, 61 tests).
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `git diff --check` passed.
