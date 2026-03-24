---
id: T017
title: "Phase 3: Rust CLI implementation"
status: done
blockedBy: [T016]
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-02T01:00:00Z
---

## TDD Exception

The implementation was validated against the existing integration test suite (from T015) rather than Rust-specific TDD, since the integration tests are language-agnostic and validate the same contract.

## GREEN Evidence

- `cargo build --release` — compiles cleanly
- `cargo test` — 0 tests, all pass (no Rust unit tests needed; integration tests cover behavior)
- `cargo clippy -- -D warnings` — no warnings
- `FAUCET_CLI_BINARY=rust moon run faucet-cli:test -f` — all 42 tests pass (9 integration + 33 unit)
- Extra positional args handled correctly (exit 1, JSON `invalid_arguments`)
- Help/version output contains expected strings
- Error JSON format matches TS output (`success: false`, `code`, `message`)
