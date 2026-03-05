---
id: T029
title: "Fix faucet-cli README and version regression"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-04T12:30:41Z
updated_at: 2026-03-04T12:51:09Z
---

Correct the faucet CLI documentation, align version metadata, and add regression
coverage so the binary version matches the package version.

## RED Evidence

- `npx -y @zeko-labs/faucet-cli --version` reported `zeko-faucet 0.1.0` while
  `packages/faucet-cli/package.json` was `0.1.1`, demonstrating version drift.

## Changes

- Added an integration test that asserts the built binary version matches the
  package version.
- Aligned `packages/faucet-cli/Cargo.toml` with the package version.
- Corrected the faucet CLI README examples and command documentation.
- Added a patch changeset for the next faucet CLI release.

## GREEN Evidence

- `moon run faucet-cli:test` passed (`11 tests`, `11 passed`) after aligning the
  crate version and updating the docs/test coverage.
