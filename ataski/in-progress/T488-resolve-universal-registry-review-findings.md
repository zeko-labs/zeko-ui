---
id: T488
title: "Resolve universal ERC20 registry review findings"
status: in-progress
blockedBy: [T487]
owner: codex
created_at: 2026-07-28T13:30:39Z
updated_at: 2026-07-28T13:30:39Z
---

## Requirements

- Add release changeset coverage for every changed publishable package, including
  the fixed `@zeko-labs/bridge-sdk` and `@zeko-labs/graphql` group.
- Make `@zeko-labs/eth-bridge-sdk` cryptographically verify every advertised
  Poseidon registry membership against the supplied root instead of comparing
  unverified snapshot values to themselves.
- Reuse one canonical TypeScript implementation of registry record packing,
  Poseidon leaf/node hashing, tree construction, and membership verification
  across the bridge SDK, Ethereum bridge SDK, and Actions indexer where package
  boundaries allow.
- Keep the canonical Merkle helpers immutable and add positive and negative
  vectors for odd compressed keys, wrong roots, wrong paths, and modified
  records.
- Expose the current authenticated registry root and count through the public
  Zeko runtime configuration and carry them through GraphQL generation and the
  bridge SDK runtime type, with explicit consistency checks against indexer
  snapshots.
- Update the TypeScript bridge surfaces for the versioned ERC-20 action encoding
  selected by the Zeko and settlement fixes, including registry index and record
  commitment.
- Preserve two-token lookup, append refresh, pending/canonical finalization
  visibility, and explicit legacy compatibility.

## Test Plan

- TDD.
- RED: add focused Ethereum SDK tests that reject arbitrary roots, wrong paths,
  and modified record fields; add runtime tests requiring root/count; add action
  encoding vectors for version/index/record commitment before implementation.
- GREEN: run focused bridge SDK, Ethereum bridge SDK, Actions indexer, and
  GraphQL tests, then their Moon lint, typecheck, build, and test gates.
- RELEASE: run the repository changeset check and `moon ci` after the task branch
  is merged into the canonical feature branch.

## RED Evidence

- Pending.

## GREEN Evidence

- Pending.
