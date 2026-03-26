---
id: T148
title: "Make direct deposit submit retry recoverable mutation errors"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T14:55:46Z
updated_at: 2026-03-24T15:05:30Z
---

## Requirements

- Fix the bridge-cli so a Mina->Zeko deposit with `--timeout-slots 1` can start cleanly even when the bridge backend returns transient mutation errors like `No key returned from mutation`.
- Keep the fix in bridge-cli; do not change bridge-ui or bridge-sdk behavior for this task.
- Make the low-level deposit submit path resilient in the same failure mode that the high-level `bridge` flow already retries.
- Add meaningful automated coverage for the recoverable mutation retry path.

## Test Plan

- TDD
- Add direct-command tests that fail on the current single-shot submit behavior, then patch the direct deposit submit flow until the new tests and existing bridge-cli tests pass.

## RED Evidence

- `node ./packages/bridge-cli/dist/cli.js deposit submit --amount 1 --timeout-slots 1 --wait false --json` fails with `No key returned from mutation`.

## GREEN Evidence

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
- `pnpm exec node ./packages/bridge-cli/dist/cli.js deposit submit --account B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq --amount 0.01 --timeout-slots 1 --wait false --json --verbose` no longer exits with `No key returned from mutation`; it remains in the submit flow past the previous five-attempt cutoff.
