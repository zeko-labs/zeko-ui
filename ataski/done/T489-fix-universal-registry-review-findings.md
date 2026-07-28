---
id: T489
title: "Fix universal registry review findings"
status: done
blockedBy: [T488]
owner: codex
created_at: 2026-07-28T17:22:01Z
updated_at: 2026-07-28T17:36:31Z
---

## Requirements

- Preserve explicit ERC20 V1 runtime and action handling while retaining the
  universal V2 registry path; select deposit hashing from immutable gateway
  action encoding metadata, never current registry membership.
- Restore legacy `ethereumToken` GraphQL/runtime configuration and route legacy
  deposit finalization and withdrawal proof requests without V2 registry
  fields, while keeping V2 selectors and authenticated memberships mandatory.
- Require caller-supplied Ethereum registry snapshots to be anchored to the
  runtime root, count, schema, and shared registry identities whenever Zeko is
  configured.
- Store and return deeply isolated immutable Ethereum registry records and
  Merkle paths.
- Bind indexed registry responses to requested selectors and require exhaustive
  responses to contain unique dense indices.
- Filter archive event pages to their requested half-open block range without
  implementing the explicitly deferred incremental registry cursor.
- Deploy a second stock fungible-token admin controlled by `PublicKey.empty`,
  rotate the token to it after the exact inventory mint, verify the frozen
  installed state, and return rotation evidence while keeping the registry
  authority separate.
- Correct the bridge SDK universal-registry deployment documentation and the
  Ethereum SDK batch-activation example.
- Keep existing changesets covering every modified publishable package and do
  not perform paid proving or deployment.

## Test Plan

- TDD.
- RED: add focused tests for explicit gateway V1/V2 deposit metadata, immutable
  registry entries, missing runtime anchors, selector substitution, duplicate
  exhaustive members, legacy runtime parsing/routing, archive event range
  filtering, and the post-mint frozen admin rotation.
- GREEN: after all implementation and documentation fixes are applied, run one
  focused verification command covering only the affected bridge SDK, Ethereum
  bridge SDK, GraphQL, and Actions indexer files; do not run repository-wide
  test or lint suites.

## RED Evidence

- Source inspection with `rg`/`sed` at target `9617a888` confirms V2 deposit
  metadata is inferred from registry lookup, `ethereumToken` is always null,
  registry lookups return internal references, supplied snapshots are accepted
  without runtime assets, selectors and event ranges are not bound, the docs
  pass `siblings`, and deployment stops with the mint-capable bootstrap admin.
- The focused tests described above do not exist at the target commit and will
  be added before implementation; per the fix-round constraint, their combined
  execution is deferred to the single final focused verification.

## GREEN Evidence

- `moon run bridge-sdk:test bridge-sdk:typecheck eth-bridge-sdk:test
  eth-bridge-sdk:typecheck graphql:typecheck actions-indexer:typecheck -f`
  passed after building the Ethereum SDK package: bridge SDK 111 tests,
  Ethereum bridge SDK 32 tests, and all four affected project typechecks.
- `pnpm --filter @zeko/actions-indexer exec vitest run
  test/archive-range-filter.test.ts` passed both focused range tests.
- `moon run eth-bridge-sdk:test eth-bridge-sdk:typecheck -f` passed all
  32 tests and the package typecheck after the final compatibility adjustment.
- No repository-wide suite, paid proving, or deployment was run.
