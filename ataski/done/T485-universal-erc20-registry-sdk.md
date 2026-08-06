---
id: T485
title: "Universal ERC20 registry SDK"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-24T12:56:32Z
updated_at: 2026-07-24T13:11:50Z
---

## Requirements

- Replace the singular ERC-20 runtime identity in `packages/eth-bridge-sdk` with a versioned canonical immutable asset-record model matching Zeko issue #425.
- Provide deterministic lookup by registry index, canonical asset ID, and Ethereum token address.
- Represent the current append-only Poseidon registry checkpoint and ordinary depth-8 membership paths without implementing Mina Poseidon in TypeScript.
- Refresh paths after append by accepting a new authenticated snapshot while preserving stable immutable records and indices.
- Reject duplicate lookup keys, malformed dense indices, wrong schema/root/count/path widths, modified records, wrong configured MFT/universal VK identifiers, and wrong shared vault before constructing bridge requests.
- Keep deposits and withdrawals for two assets on one universal bridge runtime/configuration.
- Export the new public types and APIs, retain explicit legacy single-token compatibility where existing fixtures still require it, and add the required publishable-package changeset.

## Test Plan

- TDD: first add focused SDK tests for two-asset lookup, path refresh after append, immutable record preservation, and each malformed snapshot/preflight case. Record the failing Moon test output before implementation.
- GREEN: implement the canonical registry module and integrate it into the client/config surface, then run `moon run eth-bridge-sdk:test -f`, typecheck, lint, and build.

## RED Evidence

- `moon run graphql:build -f && pnpm --dir packages/eth-bridge-sdk exec vitest run test/registry.test.ts` — failed because the new `../src/registry` API did not exist, establishing the two-asset lookup/refresh/preflight contract before implementation.

## GREEN Evidence

- `moon run eth-bridge-sdk:lint-fix -f` and
  `moon run eth-bridge-sdk:lint -f` completed successfully.
- `moon run eth-bridge-sdk:test -f` passed 22/22 tests across four files,
  including eight universal-registry tests.
- `moon run eth-bridge-sdk:build -f` and
  `moon run eth-bridge-sdk:typecheck -f` completed successfully.
