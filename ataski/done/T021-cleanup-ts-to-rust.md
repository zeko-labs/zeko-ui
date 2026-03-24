---
id: T021
title: "Phase 7: Cleanup - remove TS, rename rust-src to src"
status: done
blockedBy: [T017, T020]
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-02T04:00:00Z
---

## TDD Exception

Cleanup/migration task. Validated by integration tests passing against the final Rust binary.

## GREEN Evidence

- `moon run faucet-cli:build -f` — cargo build --release succeeds
- `moon run faucet-cli:test -f` — 9 integration tests pass (1 file)
- `moon run faucet-cli:lint -f` — cargo clippy clean, 0 warnings

## Changes

- Deleted `src/` (old TS source), renamed `rust-src/` → `src/`
- Updated `Cargo.toml` path: `src/main.rs`
- Deleted old TS unit tests: cli.test.ts, api.test.ts, commands.test.ts, support.test.ts
- Kept test/integration.test.ts (now points at Rust binary directly)
- Removed TS deps: citty, ofetch, valibot, tsdown, @vitest/coverage-v8, typescript
- Kept vitest + @types/node for integration tests
- Deleted tsconfig.json, tsconfig.build.json, tsdown.config.ts
- Updated moon.yml: Rust tasks as primary (build=cargo build, lint=clippy, check=cargo check)
- Updated package.json: files=["bin","npm"], removed dist/exports/main/types
- Updated bin/zeko-faucet.js: removed TS fallback, error message for unsupported platforms
- Removed old .github/workflows/publish.yaml from package
- Removed dist/ directory
