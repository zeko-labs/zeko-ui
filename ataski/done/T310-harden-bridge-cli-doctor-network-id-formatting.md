---
id: T310
title: harden-bridge-cli-doctor-network-id-formatting
status: done
blockedBy: []
owner: pi
created_at: 2026-06-12T10:18:00Z
updated_at: 2026-06-12T10:22:00Z
---

## Requirements

- Prevent `bridge doctor` network ID formatting from returning `undefined`.
- Prevent unexpected non-string network IDs from crashing doctor output formatting.

## Test strategy

BDD: keep doctor output expectation and run targeted doctor test plus lint.

## Plan

- Add safe stringify fallback in `formatNetworkId`.
- Run bridge-cli lint and doctor test.

## Validation

- `./node_modules/.bin/moon run bridge-cli:lint -f` passed.
- `./node_modules/.bin/moon run bridge-cli:test -f -- tests/doctor.test.ts` passed.
