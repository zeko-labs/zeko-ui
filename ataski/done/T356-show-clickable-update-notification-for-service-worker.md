---
id: T356
title: "Show clickable update notification for service worker"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:32:09Z
updated_at: 2026-06-17T05:40:15Z
---

## Requirements

- Service worker updates must not reload the bridge UI while users are interacting with it.
- When a replacement service worker is waiting or installed, show a clickable in-app notification that lets the user update on demand.
- Only after the user clicks should the app ask the waiting worker to activate and reload once after the new controller takes over.
- Avoid reload loops and keep the update prompt non-blocking.
- Acceptance criteria: a service-worker update can be detected without reloading, and a user action triggers activation/reload.

## Test Plan

- TDD. First update `service-worker-refresh.test.ts` so waiting workers do not receive `SKIP_WAITING` immediately and instead emit an update callback/action that can be clicked.
- RED path: run `moon run bridge-ui:test -f` and capture failure against the current automatic activation behavior.
- GREEN path: implement the update prompt, click handler, and coordinator behavior; rerun bridge UI tests/typecheck/lint.

## RED Evidence

- `moon run bridge-ui:test -f` failed `service-worker-refresh.test.ts` because the waiting worker received `BRIDGE_UI_SKIP_WAITING` immediately and `controllerchange` reloaded before user acceptance.
- `moon run bridge-ui:test -f` failed importing `useServiceWorkerUpdateStore`, confirming no clickable update state exists yet.

## GREEN Evidence

- `moon run bridge-ui:test -f` passed 22 files / 107 tests, including `service-worker-refresh.test.ts` and `service-worker-update-store.test.ts`.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- The service worker no longer has an install-time `skipWaiting` listener; it activates only after the in-app update action posts `BRIDGE_UI_SKIP_WAITING`.
