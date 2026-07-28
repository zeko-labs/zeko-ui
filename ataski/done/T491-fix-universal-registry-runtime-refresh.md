---
id: T491
title: "Fix universal registry runtime refresh"
status: done
blockedBy: [T490]
owner: codex
created_at: 2026-07-28T18:45:14Z
updated_at: 2026-07-28T18:58:35Z
---

## Requirements

- Atomically replace the authenticated local registry and every Bridge runtime
  consumer after an append refresh matches a freshly fetched runtime root,
  count, schema, and shared configuration.
- Treat a missing legacy gateway `assetId` as a null native/V1 asset before
  routing by immutable encoding metadata.
- Settle outer, inner, and registry indexer streams independently, persist
  every successful cursor, attribute failures to the correct stream, and keep
  repeated partial failures visible to health monitoring.
- Expose `lastFetchedRegistry` in indexer status output for all CLI lifecycle
  commands and JSON output.
- Centralize the V2 asset witness and encoding/index/commitment serialization
  used by deposit and withdrawal construction.
- Use bridge-sdk's canonical registry schema and Merkle depth constants in the
  Ethereum bridge SDK.
- Keep the registry full-rescan optimization deferred, preserve existing
  changeset coverage, and do not run proving or deployment.

## Test Plan

- TDD.
- Add focused regressions for legacy gateway rows without `assetId`, atomic
  runtime replacement after authenticated refresh, independent cursor
  persistence and failure health, CLI registry cursor visibility, and shared
  V2 binding serialization.
- Per the review-fix constraint, write the regressions before implementation
  but defer execution until one consolidated focused verification after all
  fixes are applied.

## RED Evidence

- `BridgeClient.refreshAssetRegistry` replaces only `#assets`; the readonly
  `#bridge` continues to use the root, count, and lookup closures captured
  during initialization.
- Gateway parsing passes an omitted legacy `assetId` through `requireHex`, so
  legacy rows fail before immutable encoding-version routing.
- The indexer combines inner and registry handlers in one `Promise.all`;
  either rejection loses the other successful cursor, attributes the failure
  to `inner`, and resets health errors whenever another stream succeeds.
- The CLI status projection parses but omits `lastFetchedBlock.registry`.
- Deposit and withdrawal construction independently serialize the same V2
  witness and encoding/index/commitment fields.
- The Ethereum bridge SDK declares schema and tree-depth literals already
  exported by bridge-sdk.
- Focused regressions for these contracts are absent or assert the coupled
  behavior. RED execution is deferred to the single final verification
  required by this review-fix round.

## GREEN Evidence

- `git diff --check` and focused dprint checks passed.
- Bridge SDK, Ethereum Bridge SDK, and Actions Indexer focused typechecks
  passed.
- Bridge SDK's focused ERC20 suite passed 19 tests; Ethereum Bridge SDK's
  client, gateway, and registry suites passed 32 tests; Actions Indexer's
  independent cursor, CLI status, and health suites passed 12 tests.
- Bridge SDK declaration generation passed after the shared V2 binding
  serializer was exported with an explicit isolated-declaration type.
- Moon could not load this isolated worktree because its generated root
  project ID begins with a digit, so the equivalent configured package
  commands were run directly with pnpm.
- No proving, deployment, full repository test suite, or full repository lint
  suite was run.
