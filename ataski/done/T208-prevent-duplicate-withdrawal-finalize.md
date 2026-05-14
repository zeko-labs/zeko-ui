---
id: T208
title: "prevent duplicate withdrawal finalize"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T06:10:31Z
updated_at: 2026-05-13T06:17:00Z
---

## Requirements

- Prevent the high-level bridge CLI from submitting more than one withdrawal finalization transaction for the same operation when backend status lags after the first finalization hash is returned.
- Preserve the existing long-running CLI behavior: after a finalization hash is submitted, the operation should wait for status confirmation or report the in-flight finalization clearly, not attempt another finalize.
- Apply the same invariant to deposit finalization if the same retry loop can repeat a submitted finalization while status lags.
- Keep the fix inside the standalone bridge SDK/CLI bugfix PR scope.

## Test Plan

- BDD: add or update bridge-flow tests so a finalize submission followed by a still-unfinalized status poll does not trigger a second finalize call.
- RED path: run the focused bridge CLI flow test before implementation and capture the duplicate finalize expectation failing.
- GREEN path: rerun the focused bridge CLI flow test, then the bridge CLI test/typecheck tasks.

## RED Evidence

- `moon run bridge-cli:test -f -- --run tests/bridge-flow.test.ts -t "does not resubmit withdrawal finalization"` failed with `expected 2 to be 1`, reproducing duplicate withdrawal finalization after the retry threshold elapsed.

## GREEN Evidence

- `moon run bridge-cli:test -f -- --run tests/bridge-flow.test.ts -t "does not resubmit withdrawal finalization"` passed.
- `moon run bridge-cli:test -f` passed: 77 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:build -f` passed.
- Live resume of operation `16b9e3b1-5927-4cd7-8c41-bb6d32683eef` completed with final hash `5JuxJjuCPRomLp2BMdCvaqEGuZBRXRDtq7oGqyGzERYAheGxtstg`.
