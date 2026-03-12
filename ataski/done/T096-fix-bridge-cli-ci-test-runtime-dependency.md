---
id: T096
title: "Fix bridge-cli CI test runtime dependency"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-13T00:00:00Z
updated_at: 2026-03-13T00:20:00Z
---

## Requirements

- Fix the PR #139 CI failure in `bridge-cli:test` caused by the Vitest runtime failing to resolve `@zeko-labs/bridge-sdk` in a fresh checkout.
- Keep the fix aligned with Moon task graph semantics rather than adding ad hoc test-only import hacks.
- Preserve local developer ergonomics and existing passing `bridge-cli` / `bridge-sdk` build and test behavior.
- Validate the fix against the exact failure mode from CI: `bridge-cli:test` must succeed when `packages/bridge-sdk/dist` is absent before the test task runs.

## Test Plan

- DDD. Reproduce the failure from a clean `packages/bridge-sdk/dist` state before editing code, then update the task graph or test runtime configuration, and re-run the affected Moon tasks.
- RED path:
  - remove `packages/bridge-sdk/dist`
  - run `moon run bridge-cli:test -u`
  - confirm the Vitest runtime fails to resolve `@zeko-labs/bridge-sdk`
- GREEN path:
  - rerun `moon run bridge-cli:test -u`
  - rerun `moon run bridge-cli:typecheck bridge-cli:build bridge-sdk:test bridge-sdk:typecheck`

## RED Evidence

- GitHub Actions job `66829449080` on run `23013243107` fails in `bridge-cli:test` with:
  - `Cannot find package '@zeko-labs/bridge-sdk' imported from .../packages/bridge-cli/src/core/adapter.ts`
  - `Cannot find package '@zeko-labs/bridge-sdk' imported from .../packages/bridge-cli/src/commands/bridge.ts`
- CI summary shows `bridge-cli:test` runs before `bridge-sdk:build`, while `bridge-cli` imports the published bridge SDK entrypoint that resolves through `packages/bridge-sdk/dist/index.js`.
- Local reproduction from a clean SDK build state:
  - moved `packages/bridge-sdk/dist` aside to `packages/bridge-sdk/dist.ci-backup`
  - `node -e "import('@zeko-labs/bridge-sdk')..."` from `packages/bridge-cli` fails with `Cannot find module .../packages/bridge-cli/node_modules/@zeko-labs/bridge-sdk/dist/index.js`
  - `pnpm exec vitest run tests/adapter.test.ts tests/bridge-command.test.ts` from `packages/bridge-cli` fails with the same module-resolution error as CI

## GREEN Evidence

- Fixed `packages/bridge-cli/moon.yml` so `bridge-cli:test` depends on `bridge-sdk:build`.
- Verified the exact clean-checkout failure mode now passes:
  - with `packages/bridge-sdk/dist` absent before the run, `moon run bridge-cli:test` first executes `bridge-sdk:build` and then completes the Vitest suite successfully.
- Additional validation after the fix:
  - `moon run bridge-cli:typecheck bridge-cli:build bridge-sdk:test bridge-sdk:typecheck`
