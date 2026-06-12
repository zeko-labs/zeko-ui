---
id: T313
title: "move-ui-network-boundary-to-package"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-12T10:50:20Z
updated_at: 2026-06-12T10:52:15Z
---

## Requirements

- Move the bridge UI network boundary logic currently implemented in `apps/bridge-ui/machines/networks.ts` into the shared `@zeko/networks` package.
- Keep `apps/bridge-ui/machines/networks.ts` as a thin compatibility module that does not import from `@lumina-dex/sdk`.
- The shared package must expose typed helpers for bridge UI network predicates and wallet-facing Lumina compatibility network conversion.
- Keep the Zeko nomenclature source of truth in the shared package and avoid hardcoded duplicate route/network strings at call sites.
- Investigate the local Lumina SDK source under `~/GitHub` for the wallet network model and whether it should use `{ custom: "zeko-mainnet" }`; record the conclusion before completion.

## Test Plan

- TDD: add package-level tests that fail while the bridge UI network predicates and Lumina wallet compatibility mapping only exist in the UI machine file.
- TDD: add a UI unit assertion that `machines/networks.ts` no longer imports `@lumina-dex/sdk`.
- GREEN requires the package tests, bridge UI network nomenclature test, and typechecks for the touched projects to pass.

## RED Evidence

## GREEN Evidence
