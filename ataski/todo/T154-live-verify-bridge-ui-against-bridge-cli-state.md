---
id: T154
title: "Live verify bridge-ui against bridge-cli state"
status: todo
blockedBy: [T152, T153]
owner: unassigned
created_at: 2026-03-25T10:29:31Z
updated_at: 2026-03-25T10:29:31Z
---

## Requirements

- Restart the local bridge-ui dev server after T152 and T153 land.
- Collect fresh bridge-cli route state for the validation wallet and compare it to the rendered UI state.
- Record the exact wallet, route, unresolved operation counts, and whether the cancellable lane appears.

## Test Plan

- DDD
- Use direct live validation after the automated test suite is green, and record the evidence needed to compare UI and CLI state.

## RED Evidence

## GREEN Evidence
