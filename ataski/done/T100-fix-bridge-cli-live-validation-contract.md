---
id: T100
title: "Fix bridge-cli live validation contract"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:25:00Z
updated_at: 2026-03-19T18:36:00Z
---

## Requirements

- Align the bridge CLI signer contract with the branch-local live validation environment so the CLI reads `WALLET_PRIVATE_KEY`.
- Fix the package-level live validation entrypoint so the documented single-command manual check works in this workspace without requiring a separately functioning Bun install.
- Preserve the single-command unattended bridge behavior for deposit and withdrawal validation.
- Re-run relevant automated checks before resuming live network validation.

## Test Plan

- DDD.
- RED path:
  - source `packages/bridge-cli/.env`
  - confirm the live command environment exposes `WALLET_PRIVATE_KEY`
  - run `moon run bridge-cli:live-bridge-mina-to-zeko`
  - confirm the live entrypoint fails before bridge submission because the CLI does not honor that env contract and/or the task cannot execute due to the Bun runtime dependency
- GREEN path:
  - rerun `moon run bridge-cli:test`
  - rerun the corrected single-command live entrypoint far enough to verify startup passes the previous env/runtime blockers
  - proceed into the requested live bridge validation flow

## RED Evidence

- `packages/bridge-cli/.env` defines `WALLET_PRIVATE_KEY`, but the bridge CLI currently fails startup when only that contract is present because the signer code reads a different variable name.
- `moon run bridge-cli:live-bridge-mina-to-zeko` fails before any bridge submission with:
  - `Error: Bun's postinstall script was not run.`
  - The package-level live validation entrypoint currently depends on `bun ./scripts/run-live-bridge.ts ...`, which is not reliable in this workspace install.

## GREEN Evidence

- Updated the bridge-cli signer contract to use `WALLET_PRIVATE_KEY` in `packages/bridge-cli/src/core/signer.ts`.
- Updated the package-local env example, tests, and docs to the same single-wallet contract:
  - `packages/bridge-cli/.env.example`
  - `packages/bridge-cli/tests/signer.test.ts`
  - `packages/bridge-cli/tests/bridge-command.test.ts`
  - `packages/bridge-cli/README.md`
  - `packages/bridge-cli/testing.md`
  - `packages/bridge-cli/AGENTS.md`
- Replaced the Bun-based manual live runner with a Node entrypoint:
  - removed `packages/bridge-cli/scripts/run-live-bridge.ts`
  - added `packages/bridge-cli/scripts/run-live-bridge.mjs`
  - updated `packages/bridge-cli/moon.yml` to run `node ./scripts/run-live-bridge.mjs ...`
- Verified there are no remaining active bridge-cli code/doc references to the old signer env names; only historical Ataski notes still mention them.
- Re-ran:
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-cli:build`
  - `moon run docs:build`
- I did not re-run the real-network live bridge task here because doing so would start an actual funded bridge operation, which is outside the scope of this contract/runtime fix by itself.
