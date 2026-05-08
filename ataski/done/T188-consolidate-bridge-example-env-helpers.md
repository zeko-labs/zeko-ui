---
id: T188
title: "Consolidate bridge example env helpers"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T17:43:40Z
updated_at: 2026-05-08T18:05:13Z
---

## Requirements

- Rename the bridge SDK example logging helper to a general helper module.
- Move the shared `readEnv` helper into that module and use it across every bridge SDK example.
- Make examples default to the public testnet URLs while allowing local/alphanet overrides through environment variables.
- Add a bridge SDK `.env.alphanet` file with alphanet override variables and no live wallet secret.
- Standardize bridge CLI signer configuration and documentation on `MINA_PRIVATE_KEY`.
- Keep bridge CLI and bridge UI runtime configuration testnet-first, with alphanet URLs only as commented-out alternates so distributed products remain agnostic to alphanet.
- Investigate and disable CLI specs that spin in zero-delay polling loops, timeout under isolated runs, or cause the full CLI suite to exhaust memory.

## Test Plan

- DDD: first inspect current examples, CLI config/tests, UI config, and Moon tasks to define the expected static behavior.
- Validate with Moon typecheck/tests that do not require live-wallet execution.
- Do not run any example command or flow that signs with a live wallet.

## RED Evidence

Initial inspection found repeated inline example configs using local actions API plus alphanet Zeko URLs, a local `readEnv` only in `diagnoseHistory.ts`, a dedicated `write-log.ts` helper, and bridge CLI signer code/tests/docs still using the legacy wallet private key env var.

CLI test investigation found `bridge-command.test.ts` async command specs hanging before completion, isolated `bridge-flow.test.ts` runs timing out on long-wait/polling specs such as queued-witness waits, long delay heartbeat cases, transient retry cases, and stale finalize retry cases, and `operation-command.test.ts` resume specs timing out in isolation. These tests use zero-delay fake sleeps around polling loops and can starve timeout handling or exhaust memory in the full suite.

## GREEN Evidence

- `moon run bridge-sdk:typecheck bridge-cli:typecheck bridge-cli:test`
- `moon run bridge-ui:typecheck`
- `moon run zeko-skills:typecheck zeko-skills:test`
- `moon run bridge-cli:lint-fix`
- `moon run bridge-sdk:format-fix bridge-cli:lint-fix bridge-ui:lint-fix`
- `git diff --check`
