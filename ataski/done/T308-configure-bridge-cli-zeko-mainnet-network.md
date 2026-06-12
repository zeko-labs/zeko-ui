---
id: T308
title: configure-bridge-cli-zeko-mainnet-network
status: done
blockedBy: []
owner: pi
created_at: 2026-06-11T13:45:00Z
updated_at: 2026-06-11T13:55:00Z
---

## Requirements

- Configure bridge-cli mainnet SDK config to use Zeko custom L2 network ID `zeko-mainnet`.
- Keep actions API endpoint as the codebase-defined public mainnet endpoint.
- Support the intended CLI route label `zeko:zeko-mainnet` for mainnet Zeko routes.

## Test strategy

BDD: update route/config expectations and run targeted bridge-cli tests/build.

## Plan

- Patch bridge-cli route types/known routes for `zeko:zeko-mainnet`.
- Patch mainnet SDK config `l2Network` to `{ custom: "zeko-mainnet" }`.
- Update targeted tests and validate.

## Validation

- `./node_modules/.bin/moon run bridge-cli:test -f -- tests/routes.test.ts tests/sdk-config.test.ts tests/doctor.test.ts` passed.
- `./node_modules/.bin/moon run bridge-cli:build -f` passed.
