---
id: T185
title: "Fix claim worker clone payload"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T10:37:26Z
updated_at: 2026-05-07T10:42:08Z
---

## Requirements

- Fix the claim/finalize path so Comlink worker calls receive only structured-cloneable data.
- Do not pass XState actor refs, wallet refs, bridge refs, or functions into operations worker methods.
- Add a regression test that exercises a finalize claim through the real transaction machine and verifies the worker payload can be `structuredClone`d.
- Keep unrelated local endpoint changes in `apps/bridge-ui/machines/helpers.ts` untouched.

## Test Plan

- TDD: add a failing bridge operation unit test for the finalize deposit path that makes the fake worker call `structuredClone` on its input and reject if actor refs/functions leak into the worker payload. Then change the bridge operation worker payload construction to use a cloneable parameter object.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "passes cloneable worker payloads"` fails because the finalize deposit worker receives non-cloneable payload data and the operation terminates before `BRIDGE_OPERATION_COMPLETED`.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "passes cloneable worker payloads"` passes; the finalize deposit worker receives a structured-cloneable payload without `bridge` or `wallet`.
- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/transaction-machine.test.ts` passes.
- `moon run bridge-ui:lint` passes.
- `moon run bridge-ui:typecheck` passes.
