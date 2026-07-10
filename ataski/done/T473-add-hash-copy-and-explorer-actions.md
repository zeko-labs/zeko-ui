---
id: T473
title: "add-hash-copy-and-explorer-actions"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---

## Requirements

- Replace direct hash hyperlinking in Transactions with explicit actions.
- Show transaction hash text plus Copy hash and Open explorer buttons on hover/focus.
- Keep keyboard accessibility and safe external explorer opening.
- Do not commit or push.

## Test Plan

- DDD.
- Keep explorer URL helper tests.
- Run focused bridge-ui tests, typecheck, lint, and format.

## RED Evidence

- Plain hyperlinking makes copying hashes less explicit and risks accidental navigation.

## GREEN Evidence

- Replaced direct hash hyperlinking with hash text plus Copy hash and Open explorer controls.
- Controls are revealed on hover/focus and use safe external links for explorer navigation.
- Explorer button is hidden when no explorer URL mapping exists.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
