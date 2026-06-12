---
id: T309
title: address-bridge-cli-doctor-network-id-review
status: done
blockedBy: []
owner: pi
created_at: 2026-06-11T14:05:00Z
updated_at: 2026-06-11T14:08:00Z
---

## Requirements

- Make `bridge doctor` print custom o1js network IDs as their readable custom value.
- Keep fallback formatting for unexpected non-string network IDs.

## Test strategy

BDD: update doctor output expectation and run targeted bridge-cli doctor test.

## Plan

- Patch `formatNetworkId` custom network handling.
- Update doctor test expectation.
- Run targeted validation.

## Validation

- `./node_modules/.bin/moon run bridge-cli:test -f -- tests/doctor.test.ts` passed.
