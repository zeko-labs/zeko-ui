---
id: T142
title: "Revert terminal UI cancel priority until split widget"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:20:00Z
updated_at: 2026-03-24T01:23:00Z
---

## Requirements

- Revert the bridge UI `pendingDeposit` callback back to finalize-first behavior for the current operation widget.
- Add a short comment in the bridge operation state machine explaining that older queued cancellable deposits must not route through the main widget's terminal cancel flow until the UI has a dedicated cancellable-deposit surface.
- Keep the SDK and CLI behavior unchanged.
- Update the bridge UI unit test coverage so it reflects the intended interim behavior and guards against reintroducing the terminal queue-advancement cancel path through the main widget.

## Test Plan

- DDD
- Update the existing `bridge-operation.test.ts` coverage instead of adding a one-off file.
- Validate with the relevant bridge-ui Moon tasks after the revert.

## RED Evidence

## GREEN Evidence

- 2026-03-24: `moon run bridge-ui:test`
- 2026-03-24: `moon run bridge-ui:typecheck`
- 2026-03-24: `moon run bridge-ui:lint`
