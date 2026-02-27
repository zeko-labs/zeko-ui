---
id: T006
title: "Faucet integration validation"
status: done
blockedBy: [T002, T003, T004, T005]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:56:13Z
---

Validate the integrated faucet worker, faucet UI, CLI package, and publishing
pipeline after the implementation tasks land.

## Validation Results

- `moon faucet:type-cf` passed and regenerated `apps/faucet/worker-configuration.d.ts`
- `pnpm exec tsc --noEmit -p apps/faucet/tsconfig.json` passed
- `moon faucet-ui:build -u` passed
- `pnpm install --no-lockfile --ignore-scripts` was required in the main worktree to
  provision the new `packages/faucet-cli` dependencies without touching the lockfile
- `moon faucet-cli:build` passed after the local install
- `moon faucet-cli:typecheck` passed after the local install
- `node packages/faucet-cli/bin/zeko-faucet.js whoami --json` exited `2` with
  `missing_token`
- `node packages/faucet-cli/bin/zeko-faucet.js claim bad-address --json` exited `4`
  with `invalid_address`

## Notes

- Full live end-to-end claim verification against `https://api.faucet.zeko.io/claim`
  was not run because no GitHub PAT-backed production claim was executed in this
  session.
