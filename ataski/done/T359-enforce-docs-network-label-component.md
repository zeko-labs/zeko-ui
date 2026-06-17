---
id: T359
title: "Enforce docs network label component"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:00:21Z
updated_at: 2026-06-17T07:03:00Z
---

## Requirements

- Replace the docs regression test that only checks for the absence of one internal label with a rule that verifies concrete Zeko network labels in docs content go through `<NetworkLabel />`.
- The test must reject raw helper-derived Zeko network display labels in `apps/docs/content`.
- The test must reject `zeko-m:*` network references unless they are used as `network` props on `<NetworkLabel />`.
- Keep generic prose such as "Zeko network" valid; only concrete environment labels should be governed by this component.

## Test Plan

- TDD. First update `apps/docs/tests/network-labels.test.ts` to express the component-usage boundary. The updated test should pass with the current component-backed docs content but fail for either raw display labels or raw `zeko-m:*` references added later.
- Validate with `moon run docs:test -f` and `moon run docs:build -f`.

## RED Evidence

- Previous committed test only asserted that docs content did not contain `Zeko-M`, which did not prove docs were using `<NetworkLabel />` for concrete network labels.

## GREEN Evidence

- `moon run docs:test -f` passes with `network-labels.test.ts` asserting no raw helper-derived Zeko network display labels in docs content.
- `moon run docs:test -f` also asserts every `zeko-m:*` reference in docs content is scoped to a `<NetworkLabel network="..." />` prop.
- `moon run docs:build -f` passes.
- `rg -n "Zeko Testnet|Zeko Mainnet|Zeko Alphanet|Zeko Local|zeko-m:" apps/docs/content -S` returns only `<NetworkLabel network="zeko-m:*" />` usages.
