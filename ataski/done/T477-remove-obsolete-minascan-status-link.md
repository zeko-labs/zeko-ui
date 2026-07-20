---
id: T477
title: "remove-obsolete-minascan-status-link"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-17T08:54:13Z
updated_at: 2026-07-17T08:58:00Z
---

## Requirements

- Remove the obsolete inline `View transaction status on MinaScan/ZekoScan` message from the current bridge operation explanation.
- Keep the main bridge progress messages unchanged.
- Rely on the transactions table hyperlinks for transaction status navigation.
- Ensure the obsolete text is not shown immediately after submitting a bridge transaction or after page reload.

## Test Plan

- BDD.
- RED: add user-visible component coverage proving a completed transaction message renders the bridge explanation but not the obsolete `View transaction status on` link text when a transaction URL exists.
- GREEN: remove the inline status-link rendering while keeping existing messages intact.

## RED Evidence

- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-message.test.ts` failed after adding Vue component coverage: rendered HTML still contained `View transaction status on` and the MinaScan transaction URL.
- Added `@vitejs/plugin-vue` to the bridge-ui Vitest config/dependencies so unit tests can render Vue SFCs.

## GREEN Evidence

- Removed the inline status-link block from `BridgeMessage`; transaction status navigation remains in the transactions table.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-message.test.ts` passed.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
