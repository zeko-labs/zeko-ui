---
id: T472
title: "link-transaction-hashes-to-explorers"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---

## Requirements

- Link transaction hashes in the Bridge UI Transactions table to the correct explorer.
- Mainnet Zeko -> Mina: `https://zekoscan.io/mainnet/tx/{transactionHash}`.
- Mainnet Mina -> Zeko: `https://minascan.io/mainnet/tx/{transactionHash}`.
- Testnet Zeko -> Mina: `https://zekoscan.xyz/testnet/tx/{transactionHash}`.
- Testnet Mina -> Zeko: `https://minascan.io/devnet/tx/{transactionHash}`.
- Open links in a new tab safely.
- Do not commit or push.

## Test Plan

- DDD.
- Add unit coverage for URL selection.
- Run focused table tests, typecheck, lint, and format.

## RED Evidence

- Hashes are currently plain text and do not link to explorers.

## GREEN Evidence

- Added `transactionExplorerUrl` for mainnet/testnet Mina/Zeko route-specific explorer URLs.
- Hash cells now render as safe external links when an explorer URL is available.
- Added unit coverage for all four requested explorer URL mappings.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
