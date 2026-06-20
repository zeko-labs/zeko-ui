---
id: T390
title: "fix-claimed-deposit-queue-resume"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:18:18Z
updated_at: 2026-06-19T06:22:40Z
---

## Requirements

- Reproduce and fix the real bridge-code bug where a claimed deposit can remain the active queue head after it has moved to completed transactions, leaving the next main operation paused until a simulated refresh rebuilds state.
- Keep `BUGS.md` precise and limited to bridge-code bugs being fixed in this branch; add only the bug being addressed here.
- Remove the temporary unit test that asserted the debug panel disabled-control policy, because those controls may be re-enabled manually for future debugging features.
- Do not make debug mode smarter to hide this class of issue; fix the bridge state derivation path that can block queued operations.

## Test Plan

- TDD. First add a failing bridge-ui unit test showing recovery sync ignores locally completed operations when selecting the active main queue head.
- GREEN requires the focused recovery test to pass, followed by bridge-ui lint/typecheck/test validation.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/recovery.test.ts` failed on `does not let locally completed operations block the recovered main queue head`: recovery kept `deposit-1` as started even though its local entry was completed, leaving `deposit-2` paused.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/recovery.test.ts` passed: 11 tests.
- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 4 tests.
- `moon run bridge-ui:lint` passed: Biome checked 106 files with no fixes.
- `git diff --check` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 25 files, 136 tests.
