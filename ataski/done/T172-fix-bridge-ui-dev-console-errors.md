---
id: T172
title: "Fix Bridge UI dev console errors"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T20:54:47Z
updated_at: 2026-05-06T21:03:23Z
---

## Requirements

- Fix the Bridge UI deposit flow console errors reported during local dev verification.
- Preserve the SDK signing architecture: `signMachine` owns wallet signing, the worker only waits for SDK callback completion, and no Comlink proxy is introduced.
- Ensure executable transactions returned by the bridge operation can be signed by the transaction flow without JSON parse failures.
- Address the `/metrics` 400 errors if they are caused by malformed client payloads in this flow.
- Do not revert or modify unrelated local endpoint changes in `apps/bridge-ui/machines/helpers.ts`.

## Test Plan

- TDD: first add or update focused unit coverage that reproduces the transaction signing input shape mismatch from the console trace.
- Run Bridge UI tests and typecheck after the fix.

## RED Evidence

- `moon run bridge-ui:test -f -- sign-machine.test.ts metrics-schema.test.ts` failed as expected:
  - `signMachine > passes opaque executable transaction strings to the wallet unchanged` reproduced `SyntaxError: Unexpected non-whitespace character after JSON at position 1`.
  - `MetricEventSchema > accepts sign machine metrics` failed because category `sign` is rejected.

## GREEN Evidence

- `moon run bridge-ui:test -f -- sign-machine.test.ts metrics-schema.test.ts` passed: 2 files, 4 tests.
- `moon run bridge-ui:lint-fix -f` passed with no fixes applied.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run :format-all-fix -f` passed and formatted 2 files.
- `moon run bridge-ui:test -f` was started for the full unit suite, but produced no test-file output for more than 3 minutes and was interrupted. The focused regression suite above covers the two reported console failures.
