---
id: T381
title: "Bridge UI debug worker seam"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-18T22:00:49Z
updated_at: 2026-06-18T22:06:05Z
---

## Requirements

- Add an opt-in bridge UI debug mode for backend mocking without changing default production behavior.
- Keep real Auro wallet behavior in the normal debug path: real connect, real network switch, real balances, and real `onlySign` signing.
- Introduce a typed factory seam so `bridgeMachine` can use either the current Comlink operations worker or a debug worker object.
- The default path must still create and wrap the existing `operations.worker.ts` web worker and register the Sentry web worker integration.
- The debug mode path must avoid starting the real backend SDK worker.
- Debug mode activation must be available through Nuxt public runtime config and a localStorage override.
- Keep the seam small and testable; do not implement backend scenarios or the panel in this task.

## Test Plan

- TDD: add focused unit coverage that fails while the bridge machine always constructs the real Comlink worker and has no debug-mode factory/config seam.
- RED target: a bridge-ui unit test for debug config parsing and worker selection.
- GREEN target: the focused unit test, `moon run bridge-ui:test -f`, and `moon run bridge-ui:typecheck -f`.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-worker-seam.test.ts` failed as expected because `../../machines/debugMode` and `../../machines/operationWorkerClient` do not exist yet.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-worker-seam.test.ts` passed: 1 file, 4 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed: 23 files, 118 tests.
