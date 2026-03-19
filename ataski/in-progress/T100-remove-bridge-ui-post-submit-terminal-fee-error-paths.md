---
id: T100
title: "Remove bridge-ui post-submit terminal fee-error paths"
status: in-progress
blockedBy: []
owner: codex-ui-worker
created_at: 2026-03-19T00:00:00Z
updated_at: 2026-03-19T00:00:00Z
---
## Requirements

- Scope is only the first-withdrawal fee error handling in `apps/bridge-ui`.
- Keep the user-facing first-withdrawal-too-small message mapping in `app/errors.ts`.
- Remove post-submit terminal flow handling for that error:
  - remove the `TerminalError` event from the withdrawal machine
  - remove `isTerminalBridgeError` usage from the withdrawal pending/finalize transitions
  - do not special-case this error after submission has already succeeded
- Ensure submit-phase failures still land in `FAILED` and preserve the mapped error message for both:
  - local SDK precheck failure
  - backend/sequencer submit failure carrying the same error family
- Add focused tests proving the fee error is still recognized and that the bridge UI no longer relies on pending/finalize terminal handling for this case.

## Test Plan

- DDD. First verify the current UI machine and error helpers special-case this error after submission.
- Then remove the post-submit special handling and add regression tests for:
  - error helper mapping
  - absence of terminal post-submit control flow for this fee error
- Validate with:
  - `moon bridge-ui:test`
  - `moon bridge-ui:typecheck`

## RED Evidence

## GREEN Evidence
