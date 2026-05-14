---
id: T231
title: "Final code-only validation for PR-159"
status: done
blockedBy: [T164, T165]
owner: codex
created_at: 2026-03-30T16:02:00Z
updated_at: 2026-03-30T16:07:51Z
---

## Requirements

- Re-run `moon run bridge-ui:test` and `moon run bridge-ui:typecheck` after the scope cleanup and bridge-ui validation changes land.
- Confirm the final branch diff is limited to bridge-ui and WEB-404 board history.
- Record the read-only live bridge state used for comparison and note that rendered real-wallet verification is deferred for this pass.

## Test Plan

- DDD
- Use the final diff inspection and bridge-ui automated checks as the completion gate for this code-only pass.

## RED Evidence

- The browser automation environment can open the local dev server, but the page reports `No Wallet Extension`, so rendered real-wallet verification is not executable in this pass.

## GREEN Evidence

- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
- Read-only live bridge state for `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq` at slot `791288` shows one cancellable deposit (`63741`), pending non-cancellable deposits (`63452`, `63530`, `63537`, `63540`, `63638`, `63641`, `63643`, `63644`, `63681`, `63735`), and no pending withdrawals.
- `git diff --name-status main --` is now limited to bridge-ui files and WEB-404 board history.
- Rendered live-wallet validation is explicitly deferred in this pass because the available browser context has no Auro wallet extension.
