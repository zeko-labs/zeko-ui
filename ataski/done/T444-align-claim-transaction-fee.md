---
id: T444
title: "Align claim transaction fee"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T14:04:49Z
updated_at: 2026-06-25T14:09:41Z
---

## Requirements

- Resolve Codex review finding: the selected-route fee panel says claim costs 0.1 MINA, but the bridge operation machine signs claim/cancel/finalize transactions with a 1 MINA initial fee.
- Preserve the user-requested static fee model: 0.1 MINA send/request plus 0.1 MINA claim, 0.2 MINA total.
- Make the transaction payload fee and fee disclosure agree without adding new libraries or debug-only behavior.

## Test Plan

- TDD.
- RED: update bridge-operation fee payload coverage so a claim/finalize transaction expects a 0.1 MINA fee.
- GREEN: change the bridge operation initial claim/cancel/finalize fee to 0.1 MINA and keep fee disclosure tests green.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts` failed as expected: `passes cloneable worker payloads when finalizing a deposit` expected `feeNanomina: 100000000`, but the bridge operation machine sent `1000000000`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts` passed: 2 files, 35 tests.
- `moon run -f bridge-ui:format-fix` passed.
- `moon run -f bridge-ui:test` passed: 31 files, 180 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- `git diff --check` passed.
