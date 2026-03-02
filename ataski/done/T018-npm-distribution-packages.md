---
id: T018
title: "Phase 4: npm distribution packages"
status: done
blockedBy: [T017]
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-02T02:00:00Z
---

## TDD Exception

Config/packaging only. No runtime behavior changes.

## GREEN Evidence

- 6 platform package.json files created in npm/{darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64,win32-arm64}/
- Updated bin/zeko-faucet.js to platform-aware shim with TS fallback
- Updated package.json with optionalDependencies
- `moon faucet-cli:test -u` — all 42 tests pass (TS fallback works correctly)
