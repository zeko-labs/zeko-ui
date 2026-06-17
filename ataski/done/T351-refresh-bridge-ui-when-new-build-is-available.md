---
id: T351
title: "Refresh bridge UI when new build is available"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:07:35Z
updated_at: 2026-06-17T05:20:00Z
---

## Requirements

- Investigate the current bridge UI service worker/update behavior and implement a service-worker based approach that fully refreshes the UI when a newly deployed build is available.
- The refresh must address users who keep an old UI tab open and do not hard refresh, which can leave wallet integration behavior stale.
- Do not add a new third-party library unless absolutely necessary.
- Prefer a small Nuxt client plugin plus service worker message/listener flow if the existing service worker is custom.
- The implementation must avoid reload loops and should only trigger when a new service worker controls the page or a build update is detected.
- Acceptance criteria: when a waiting/activated replacement service worker is detected, the app asks it to activate if needed and reloads the page once under the new controller.

## Test Plan

- TDD. First add unit-level tests for the update coordinator logic, covering waiting service worker activation, controllerchange reload, and reload-loop protection.
- RED path: run the bridge UI unit tests and capture the failing assertions before implementation.
- GREEN path: implement the update coordinator and rerun the unit tests plus bridge UI typecheck.

## RED Evidence

- `moon run bridge-ui:test -f` fails importing `../../app/service-worker/updateRefresh` from `service-worker-refresh.test.ts`, confirming the update-refresh coordinator does not exist yet.

## GREEN Evidence

- `moon run bridge-ui:test -f` passed: 21 test files, 105 tests, including `service-worker-refresh.test.ts`.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
