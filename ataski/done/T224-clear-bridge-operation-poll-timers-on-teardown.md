---
id: T224
title: "Clear bridge operation poll timers on teardown"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T12:17:20Z
updated_at: 2026-03-25T12:25:52Z
---

## Requirements

- Make the bridge-ui operation polling actors release their retry timers when the actor is stopped or destroyed.
- Remove the possibility that orphaned `setTimeout` retries keep the Vitest browser process alive after tests complete.
- Keep the polling behavior unchanged while the actor is active.

## Test Plan

- TDD
- Add machine-level coverage with fake timers to prove stopping a pending deposit or withdrawal actor clears scheduled retry timers.
- Re-run `moon run bridge-ui:test` and `moon run bridge-ui:typecheck`.

## RED Evidence

- `pendingDeposit` and `pendingWithdrawal` scheduled retry `setTimeout`s but only aborted their signals on teardown, which left timer handles alive after the actor stopped.
- The initial fake-timer test implementation also used `runAllTimersAsync()` against a self-rescheduling poll loop, which recreated the leak inside the test itself and had to be corrected to a single interval advance.

## GREEN Evidence

- Added explicit poll schedulers in the deposit and withdrawal pending actors and cleared them on teardown.
- Added machine-level cleanup tests proving pending deposit and withdrawal actors clear their retry timers on stop.
- Clean validation after killing stray test processes:
  - `moon run bridge-ui:test`
  - `moon run bridge-ui:typecheck`
