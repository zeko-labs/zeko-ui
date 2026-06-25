---
id: T450
title: "Update tooltip fee base"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T17:21:09Z
updated_at: 2026-06-25T17:24:39Z
---

## Requirements

- Update the bridge fee tooltip disclosure to use a 0.4 MINA base bridge fee for both Mina to Zeko and Zeko to Mina routes.
- Preserve the route-specific dynamic account creation fees: Mina to Zeko may add 0.1 MINA for the helper account and 0.1 MINA for the recipient account on Zeko; Zeko to Mina may add 1 MINA for the helper account and 1 MINA for the recipient account on Mina.
- The resulting first-transfer maximums must be 0.6 MINA for Mina to Zeko and 2.4 MINA for Zeko to Mina.
- Do not change route minimum validation.
- Do not expose a request/claim split in the tooltip disclosure when the updated fee logic only defines a total base fee.

## Test Plan

- TDD: update the focused bridge fee unit test first so the current 0.2 base fee and old maximums fail.
- RED should prove that the expected tooltip fee logic is now 0.4 base, 0.6 Mina to Zeko first-transfer maximum, and 2.4 Zeko to Mina first-transfer maximum.
- GREEN should pass the focused bridge fee test after the fee disclosure utility is updated.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-fees.test.ts` failed as expected before runtime changes.
- Failure summary: Mina to Zeko fee disclosure still returned `static.totalMina: 0.2` and `firstTransfer.maximumTotalMina: 0.4` instead of `0.4` and `0.6`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-fees.test.ts` passed: 1 file, 4 tests.
- `moon run -f bridge-ui:lint` passed: Biome checked 117 files with no errors.
- `moon run -f bridge-ui:typecheck` passed: Nuxt typecheck completed after dependency builds.
- `moon run -f bridge-ui:test` passed: 31 files, 183 tests.
- `git diff --check` passed.
- Dev server recovered after dependency rebuild reloads; `curl http://localhost:3090/` returned HTTP 200.
