---
id: T212
title: "Build cancellation queue UI"
status: done
blockedBy: [T139]
owner: codex
created_at: 2026-03-24T13:59:56Z
updated_at: 2026-03-24T14:11:41Z
---

## Requirements

- Render cancellable recovered deposits in a separate queue strip in bridge-ui.
- Keep the existing main operation panel and regular next-transactions queue focused on the serialized main lane only.
- Add an inline cancellation card with a cancel CTA, pending-style status, and compact copy for waiting, cancelling, and cancelled states.
- Ensure cancellable deposits do not hide the bridge input form when there is no active main-lane operation.

## Test Plan

- BDD
- Add unit coverage for cancellation-ready status text and separate queue selection without requiring a browser-only component harness.

## RED Evidence

- The existing UI had no separate cancellation lane and still mapped cancellation-ready deposits to failed/error styling.

## GREEN Evidence

- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
