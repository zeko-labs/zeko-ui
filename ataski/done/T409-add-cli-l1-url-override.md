---
id: T409
title: "Add CLI L1 URL override"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T14:35:00Z
updated_at: 2026-06-19T15:45:05Z
---

## Requirements

- Add an optional CLI override for the Mina L1 GraphQL URL so recovery/status/finalization can avoid an unhealthy default gateway without source edits.
- Thread the override through adapter creation into Bridge SDK config.
- Keep default route config unchanged when the flag is omitted.
- Use the override to resume the existing withdrawal operation after the recipient L1 account has been funded.

## Test Plan

- TDD: add focused CLI configuration tests that prove the L1 URL override is accepted and passed into SDK config/adapter creation.
- Then wire the option through the same command paths used for operation recovery.

## RED Evidence

- `operation status c830... --verbose --actions-api http://127.0.0.1:9100/graphql` hung for more than two minutes after L2 withdrawal discovery, while direct account queries to `https://gateway.mina.devnet.zeko.io` timed out and the same queries to `https://mina.devnet.zeko.io/graphql` returned immediately.

## GREEN Evidence

- Added shared `--l1-url` and `--l1-archive-url` flags and threaded them through adapter creation into Bridge SDK config without changing route defaults.
- `moon run bridge-cli:test -f -- tests/cli.test.ts tests/sdk-config.test.ts tests/direct-commands.test.ts` passed: 3 files, 40 tests.
- `moon run bridge-cli:build -f` and `moon run bridge-cli:typecheck -f` passed.
- `operation status c83028f1-deef-4cef-82c6-1eb91e70d7c8 --verbose --actions-api http://127.0.0.1:9100/graphql --l1-url https://mina.devnet.zeko.io/graphql --l1-archive-url https://gateway.mina.archive.devnet.zeko.io` completed and returned `can_finalize=true`, `target_index=10610`, `claimable_index=10610`, `pending_ahead=0`.
- `operation resume c83028f1-deef-4cef-82c6-1eb91e70d7c8 --json --verbose --poll-interval-ms 300000 --actions-api http://127.0.0.1:9100/graphql --l1-url https://mina.devnet.zeko.io/graphql --l1-archive-url https://gateway.mina.archive.devnet.zeko.io` completed with final transaction `5JuQcGsHJ5Rsz1iwFn1xGPAQFHHkRwGaJ1njGVQf66NWrhKtzPC7`, included in L1 best chain block `529197`.
