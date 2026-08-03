---
id: T486
title: "Index universal ERC20 registry"
status: done
blockedBy: [T485]
owner: codex
created_at: 2026-07-24T13:12:30Z
updated_at: 2026-07-24T13:43:30Z
---

## Requirements

- Persist immutable canonical Ethereum asset records and append-only registry
  checkpoints in the Actions indexer/API without treating mutable membership
  paths as part of asset identity.
- Expose deterministic current-registry lookup by dense index, canonical asset
  ID, and checksummed Ethereum token address.
- Return the latest authenticated depth-8 membership path with root, count, and
  schema version so SDK clients can preflight ordinary asset membership.
- Preserve historical asset records and indices while refreshing all affected
  current paths after an append.
- Reject non-sequential checkpoints, record drift, duplicate lookup identities,
  malformed paths, and a computed root that does not match the checkpoint.
- Cover two assets registered under one shared registry and keep existing
  action-indexer behavior unchanged.

## Test Plan

- RED: add focused API/repository tests for a two-record snapshot, all lookup
  keys, path refresh after append, historical record preservation, and malformed
  append rejection; record their failure before implementation.
- GREEN: implement the schema, persistence seam, ingestion validation, and
  public API, then run the focused tests plus Actions API/indexer lint,
  typecheck, and test gates.

## RED Evidence

- `pnpm --filter @zeko/actions-indexer exec vitest run
  test/asset-registry.test.ts` failed because `../src/asset-registry` did not
  exist, establishing the two-asset checkpoint, lookup, path-refresh, and
  malformed-append contract before implementation.

## GREEN Evidence

- `pnpm --filter @zeko/actions-indexer exec vitest run
  test/asset-registry.test.ts` passed 4/4 registry reconstruction, path
  refresh, dense append, duplicate-identity, range, and membership tests.
- `moon run actions-api:manual-db-test -f` applied the generated PostgreSQL
  schema and passed 17/17 Actions API tests, including latest/historical
  lookup by index, asset ID, and Ethereum address.
- Actions API, indexer, and GraphQL lint, typecheck, and build tasks passed.
- The bridge SDK passed 106 tests, including authenticated two-asset
  membership JSON and exhaustive append-witness construction; the Ethereum
  SDK passed 22/22 tests plus lint, typecheck, and build.
