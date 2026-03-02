---
id: T016
title: "Phase 2: Rust project scaffold and moon tasks"
status: done
blockedBy: [T015]
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-01T02:00:00Z
---

Set up Cargo.toml, rust-src/ directory structure, and moon.yml Rust tasks.

## TDD Exception

This is scaffold/config work — no runtime behavior changes. Validated by `cargo check` compiling successfully.

## GREEN Evidence

- `cargo check` — clean compilation (0 warnings)
- `moon faucet-cli:check-rs` — task runs successfully
- Created: Cargo.toml, rust-src/{main,cli,api,errors,output,validation}.rs, rust-src/commands/{mod,claim,whoami}.rs
- Updated: moon.yml (added build-rs, test-rs, check-rs, lint-rs tasks), .gitignore (added target/, Cargo.lock)
