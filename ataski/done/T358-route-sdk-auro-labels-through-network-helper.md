---
id: T358
title: "Route SDK Auro labels through network helper"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T06:35:16Z
updated_at: 2026-06-17T06:45:00Z
---

## Requirements

- Remove SDK-owned hardcoded user-facing Auro network display labels where an equivalent label can come from `@zeko/networks`.
- Keep internal network IDs and wallet chain names compatible with Auro.
- Update the docs app so public docs pages render Zeko network labels from `formatUserFacingNetworkLabel(...)` instead of spelling internal `Zeko-M` labels in content.
- Acceptance criteria: user-facing Zeko mainnet display copy is centralized in the shared networks helper; SDK tests prove the Auro labels and add-chain metadata use that shared helper; docs content no longer exposes `Zeko-M` to readers.

## Test Plan

- TDD. First update SDK tests to expect Auro label values to match `formatUserFacingNetworkLabel(...)` from `@zeko/networks` instead of a manually repeated string, then update SDK code to satisfy those assertions.
- Validate the docs app with the existing docs test/build tasks after the content change.

## RED Evidence

- `moon run docs:test -f` fails `network-labels.test.ts` because six docs content files still contain `Zeko-M` and `.vitepress/theme/components/NetworkLabel.vue` does not exist.
- `moon run sdk:test -f` fails `wallet.test.ts` because `packages/sdk/src/networks.ts` still contains the shared user-facing mainnet label literal.

## GREEN Evidence

- `moon run docs:test -f` passes with `network-labels.test.ts` covering docs content and the helper-backed docs label component.
- `moon run docs:build -f` passes after adding `@zeko/networks` as a docs app dependency and wiring the Moon project dependency.
- Built docs HTML renders helper-derived labels such as `Zeko Testnet` and does not render the previous docs content copy.
- `moon run sdk:test -f` passes with the SDK source centralization assertion.
- `moon run sdk:typecheck -f` passes.
- `moon run sdk:lint -f` passes.
