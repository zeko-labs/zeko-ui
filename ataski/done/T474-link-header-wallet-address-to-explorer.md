---
id: T474
title: "link-header-wallet-address-to-explorer"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---

## Requirements

- Header wallet address badge should link to the matching explorer account page when a mainnet network is selected.
- Zeko mainnet selected -> Zekoscan account URL.
- Mina mainnet selected -> Minascan account URL.
- Non-mainnet networks should keep current non-link behavior unless a known account URL is explicitly added.
- Keep visual styling unchanged.
- Do not commit or push.

## Test Plan

- DDD.
- Run bridge-ui typecheck, lint, and format.

## RED Evidence

- Header wallet address badge is currently plain text and cannot open the selected network explorer.

## GREEN Evidence

- Header wallet address badge links to `https://zekoscan.io/mainnet/account/{address}` when Zeko mainnet is selected.
- Header wallet address badge links to `https://minascan.io/mainnet/account/{address}` when Mina mainnet is selected.
- Non-mainnet selections keep the existing non-link badge behavior.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
