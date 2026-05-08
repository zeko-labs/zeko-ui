---
id: T191
title: "Refine vue xstate selector cleanup"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T18:40:10Z
updated_at: 2026-05-08T18:42:08Z
---

## Requirements

- Refactor `useSelector` to use Vue watcher `onCleanup` for per-actor subscription cleanup instead of a manually retained mutable subscription.
- Keep explicit `onScopeDispose` handling to stop the watcher when the selector is created inside a Vue effect scope.
- Preserve support for actor refs that start as `undefined`, later become an actor, and may later be replaced.
- Preserve the PR-style `useActorRef` and `useActor` scoped lifecycle behavior already present in the local helper.

## Test Plan

- TDD/characterization: add focused tests for reactive child actor subscription and actor replacement cleanup, then refactor implementation without changing observable behavior.
- Validate with `moon run -f bridge-ui:test -- test/unit/vue-xstate.test.ts`.
- Validate type safety with `moon run -f bridge-ui:typecheck`.

## Test Strategy Exception

This is an implementation refactor of already-correct behavior. The existing reactive actor-ref test already passes on the current implementation, so there is no meaningful failing RED path without inventing a fake defect. The guardrail is to add a characterization test for actor replacement/stale subscription cleanup before the refactor, then require the focused test suite and typecheck to remain green.

## GREEN Evidence

- Added `useSelector` characterization coverage for replacing an actor ref and ignoring stale emissions from the previous actor.
- `moon run -f bridge-ui:test -- test/unit/vue-xstate.test.ts` passed.
- `moon run -f bridge-ui:typecheck` passed.
- `git diff --check` passed.
