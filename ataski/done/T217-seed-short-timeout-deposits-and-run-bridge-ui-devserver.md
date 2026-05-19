---
id: T217
title: "Seed short-timeout deposits and run bridge-ui devserver"
status: done
blockedBy: [T146]
owner: codex
created_at: 2026-03-24T14:40:01Z
updated_at: 2026-03-24T15:29:32Z
---

## Requirements

- Use the bridge CLI from the canonical worktree to submit multiple Mina-originated deposits for one wallet with the shortest supported timeout window.
- Start the bridge-ui development server from the repo root using moon after the deposits are submitted.
- Report the wallet address associated with the cancellable queue so the user can validate the UI manually.
- Do not modify the SDK or CLI timeout semantics as part of this validation setup.

## Test Plan

- DDD
- Validate by successfully creating the deposits, starting the dev server, and confirming the target wallet address and command/session details.

## RED Evidence

- The CLI exposes only `timeoutSlots`, and this repo defines one slot as `180` seconds, so a literal 1-minute window is not supported without changing CLI/sdk semantics.
- `deposit submit` repeatedly failed with `No key returned from mutation`.
- A higher-level `bridge` submission with `--timeout-slots 1` succeeded once for `amount=1`, but fresh submissions with distinct payloads then hit nonce replacement behavior and the successful hash still had not appeared in `deposit status` during the validation window.

## GREEN Evidence

- Derived queue wallet address: `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq`
- Short-timeout deposit submissions succeeded with hashes:
  - `5Ju6jh2tSLuAoHH2f4wWVsKziLxZoY5HYPCV1pkvgXZzuV7r46RX`
  - `5JtXgv7bAUC7X6qf569jkwFH1qn5nWUJjuMsKPw1LN87zk6bhqA8`
- `deposit status --latest false --json` now reports `count: 14` for the queue wallet, with three currently unresolved deposits visible in the queue at indexes `63452`, `63530`, and `63537`.
- Restarted the bridge UI dev server cleanly with `moon run bridge-ui:dev`
- Dev server available at `http://localhost:3090/`
