---
id: T440
title: "Keep claim wallet rejections retryable"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T12:49:06Z
updated_at: 2026-06-25T12:53:38Z
---

## Requirements

- Address Codex review P1: wallet rejection during claim/finalize must not strand the bridge in final `FAILED` with `activeOperation` still set and no retry path.
- When a user rejects the wallet prompt during claim/finalize for a deposit or withdrawal, keep the existing operation visible and retryable in the claim-ready state instead of completing, terminating, or hiding a backend failure.
- Preserve the existing behavior that backend claim/finalize failures remain visible as `FAILED` so users get feedback instead of falling into a silent claim loop.
- Preserve the existing behavior that pre-submit wallet rejection releases the active operation because no bridge operation has been submitted yet.

## Test Plan

- BDD.
- RED: add bridge machine regression coverage proving claim-side wallet rejection returns to `TO_FINALIZE` with `activeOperation` still pointing to the operation and does not remove the submitted operation.
- GREEN: update the bridge operation finalize error path so claim-side `QuietError` returns to a retryable claim state while backend failures still surface as failed UI.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts` failed as expected: `keeps a deposit claim wallet rejection retryable` and `keeps a withdrawal claim wallet rejection retryable` both terminated the actor before the predicate could observe `TO_FINALIZE` with the `QuietError`, proving claim-side wallet rejection currently strands the operation in final `FAILED`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts` passed: 1 file, 24 tests.
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/bridge-operation.test.ts test/unit/metrics.test.ts` passed: 3 files, 35 tests.
- `moon run -f bridge-ui:format-fix` passed and formatted 1 file.
- `moon run -f bridge-ui:test` passed: 31 files, 175 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- `git diff --check` passed.
