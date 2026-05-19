---
id: T211
title: "Refactor bridge recovery into main and cancellation lanes"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T13:59:56Z
updated_at: 2026-03-24T14:11:41Z
---

## Requirements

- Consume the SDK per-deposit cancellation eligibility in bridge-ui recovery.
- Split unfinished recovered operations into a serialized main lane and a separate cancellation lane.
- Remove recovered deposit/withdrawal parallelization from the main lane.
- Add bridge-level coordination so only one cancellation-lane operation may actively cancel at a time.

## Test Plan

- TDD
- Add a pure recovered-operation bucketing helper and cover it with unit tests before relying on the logic in the bridge machine.

## RED Evidence

- `moon run bridge-ui:typecheck` initially failed on bridge event typing, worker `cancellable` typing, and recovered-operation helper union types.
- `moon run bridge-ui:test` initially failed on the paused cancellable deposit test because the mocked wallet network did not match the deposit source network.

## GREEN Evidence

- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
