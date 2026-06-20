---
id: T389
title: "disable-unused-debug-panel-controls"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:07:40Z
updated_at: 2026-06-19T06:11:08Z
---

## Requirements

- Disable these debug panel controls until they are manually needed for a new feature: Reset, Advance, Sync Backend, Fee Retry, Terminal Error, Transient Error, Cancellable, Clear Logs, and Export.
- Keep the controls visible but non-interactive so the panel layout stays stable and the disabled state is clear.
- Leave scenario selection, Seed Deposit, Seed Withdrawal, Sim Refresh, and Clear Completed enabled.
- Do not change mock backend semantics, bridge machine behavior, or hidden controller behavior as part of this task.

## Test Plan

- BDD. First add a failing debug-panel unit test that asserts each named button is rendered disabled and that the currently useful controls remain enabled.
- GREEN requires the focused debug-panel test to pass, followed by bridge-ui lint/typecheck/test validation.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts` failed on `disables controls that are not currently useful for bug discovery`: the requested controls had no disabled marker or `:disabled` binding yet.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 5 tests.
- `moon run bridge-ui:lint` passed: Biome checked 106 files with no fixes.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 25 files, 136 tests.
- `git diff --check` passed.
