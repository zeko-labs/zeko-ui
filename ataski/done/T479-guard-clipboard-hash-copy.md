---
id: T479
title: "guard-clipboard-hash-copy"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-20T10:38:00Z
updated_at: 2026-07-20T10:40:00Z
---
## Requirements

- Address review feedback in `apps/bridge-ui/app/components/BridgeOperations.vue`.
- Avoid runtime crashes when `navigator.clipboard` is unavailable in insecure contexts or older browsers.
- Keep copy feedback behavior unchanged when clipboard write succeeds.
- Do not push.

## Test Plan

- Test Strategy Exception: this is a defensive browser API guard in a Vue template helper; existing harness does not mount this component interaction. Validate with typecheck, lint, and format.

## RED Evidence

- Test Strategy Exception recorded before source edits.

## GREEN Evidence

- Added `navigator.clipboard` guard before calling `writeText` in `copyHash`.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
