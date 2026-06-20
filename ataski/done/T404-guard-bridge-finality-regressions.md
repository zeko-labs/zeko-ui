---
id: T404
title: "Guard bridge finality regressions"
status: done
blockedBy: [T389]
owner: codex
created_at: 2026-06-19T00:00:00Z
updated_at: 2026-06-19T04:57:00Z
---

## Requirements

- Update repository instructions and/or the Zeko bridge finality runbook so future agents must not change bridge operation latency semantics without explicit operator sign-off.
- State clearly that ordinary bridge CLI validation must prove fresh deposits and withdrawals with the CLI, and that seeing an operation result must not require Mina canonical finality unless the protocol explicitly requires it.
- Require agents to distinguish chain visibility, pending inclusion, and canonical finality in diagnostics and code changes.
- Require tests for any Actions API or SDK change that alters whether pending rows are visible to finalization code.
- Keep the guidance concise enough to preserve agent judgment while making this specific regression hard to repeat.

## Test Plan

- Documentation guardrail task with a narrow Test Strategy Exception for automated tests: this changes repo instructions and runbook text, not runtime behavior.
- Validation will be `git diff --check` plus review of the edited instruction text for the concrete guardrails above.

## RED Evidence

- Test Strategy Exception: this task updates repository guidance only. The meaningful validation is text review against the requirements plus `git diff --check`; runtime behavior is covered by T389.

## GREEN Evidence

- Updated `AGENTS.md` with bridge finality and latency guardrails.
- Updated Zeko skill bridge/debugging references to distinguish chain visibility, pending inclusion, and canonical finality, and to require fresh CLI deposit and withdrawal evidence for bridge health validation.
- `moon run zeko-skills:check -f` passed: 6 test files, 20 tests, skill check passed.
- `git diff --check` passed.
