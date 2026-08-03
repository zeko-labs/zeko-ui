---
id: T488
title: "Resolve universal ERC20 registry review findings"
status: done
blockedBy: [T487]
owner: codex
created_at: 2026-07-28T13:30:39Z
updated_at: 2026-07-28T14:16:15Z
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

- The Ethereum SDK accepted arbitrary registry roots and paths because it only
  compared snapshot fields without reconstructing the Poseidon root.
- Runtime configuration did not authenticate the current registry checkpoint or
  registration authority.
- Registration and bridge actions did not bind the governed authority, registry
  index, or record commitment.

## GREEN Evidence

- Commit `c1b850b6` centralizes immutable registry hashing, verifies complete
  membership paths, adds governed registration signing, exposes authenticated
  runtime fields, and binds V2 bridge actions to registry records.
- Focused validation passed: bridge SDK 107 tests, Ethereum bridge SDK 27 tests,
  Actions indexer registry 4 tests, plus lint, typecheck, and build for all four
  affected projects.
- Repository-wide `moon ci` passed 34 actions (4 cached) with 6 setup actions
  skipped. Log: `logs/ui-moon-ci-20260728T141633Z.log`.
