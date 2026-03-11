---
id: T066
title: "Finalize bridge-cli release and validator ops"
status: in-progress
blockedBy: [T065]
owner: codex
created_at: 2026-03-11T13:15:00Z
updated_at: 2026-03-11T13:15:00Z
---

Finalize the bridge-cli PR for review by validating the real high-level bridge flow locally, fixing any issues found, shifting release instructions to the Changesets flow, and adding a post-deploy script that pushes validator secrets from an `.env` file into Cloudflare.

Scope:

- run the manual local bridge validation in both supported directions using the root `.env`
- fix any runtime or validation issues uncovered by those live checks
- update operator docs so release is described through Changesets instead of ad-hoc workflow dispatch
- add a post-deploy secret sync script for `services/bridge-validator` that reads an `.env` file and pushes the supported secrets to Cloudflare with Wrangler
- add or update tests for the new script and documentation-adjacent helper logic where practical
- add a Changeset entry for the bridge-cli release prep work

## RED Plan

Start with failing or incomplete evidence for:

- local live bridge validation in both directions using the single `bridge` command
- absence of a supported post-deploy Cloudflare secret sync script
- release docs still pointing users at ad-hoc workflow dispatch rather than the Changesets release path

Validation will use:

- `moon run bridge-cli:live-bridge-mina-to-zeko`
- `moon run bridge-cli:live-bridge-zeko-to-mina`
- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run docs:build`

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-cli:live-bridge-mina-to-zeko`

Failures reproduced:

- the manual live-validation Moon task invoked Vitest through the default config, which excludes `tests/**/*.manual.test.ts`, so the task exited with `No test files found`
- after fixing the task path, the built CLI crashed under Node 24 with `ERR_AMBIGUOUS_MODULE_SYNTAX` because `o1js` had been bundled into the ESM output
- during resumed long-wait operation polling, the bridge SDK leaked `canCancelDeposit result:` debug output into stderr, making progress noisy

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
- `moon run docs:build`

Real-network validation evidence:

- `bridge --from mina:testnet --to zeko:testnet --amount 1 --json` successfully submitted a live deposit with hash `5JtdoTmyLTSJ5v1na3YjjUzx5RPsQpM4MRSNU8VNfw4UFKHNQuW1`
- persisted operation `52387a62-e395-4a1b-87ea-4c22f9e191a0` resumed cleanly through `operation resume` after the harness fixes
- resumed progress showed only curated heartbeat lines after removing the SDK debug log leak
