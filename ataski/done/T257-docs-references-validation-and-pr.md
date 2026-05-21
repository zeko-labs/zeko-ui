---
id: T257
title: "Docs references validation and PR"
status: done
blockedBy: [T253, T254, T255, T256]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T15:16:56Z
---

## Requirements

- Update `packages/bridge-cli/README.md`, `packages/bridge-sdk/README.md`, SDK example env files, `packages/zeko-skills/zeko/references/30-bridge-and-faucet.md`, `packages/zeko-skills/zeko/references/40-endpoints-and-curl.md`, and any docs site pages that mirror package READMEs.
- Docs must state testnet Actions API `https://testnet.api.actions.zeko.io/graphql` and mainnet Actions API `https://api.actions.zeko.io/graphql`.
- Docs must state alpha Bridge UI is a testnet alias, mainnet Bridge UI is `https://bridge.zeko.io`, and testnet Bridge UI is `https://testnet.bridge.zeko.io` with `https://alpha.bridge.zeko.io` as an alias.
- SDK examples must use matching L1/L2 network IDs and Actions API endpoint.
- Run the full automated validation set from `docs/BRIDGE_MAINNET_READINESS_PLAN.md`.
- Update the Implementation Review Log for every implementation action, decision, command choice, or file edit not explicitly specified by the plan.
- Commit the completed work, push the branch, and open a PR for review.

## Test Plan

- DDD: inspect docs/references for stale `api.actions.zeko.io` testnet-only guidance and stale `alpha` wording before edits.
- GREEN validation:
  - full command set listed in `docs/BRIDGE_MAINNET_READINESS_PLAN.md`
  - `git status --short`
  - successful commit
  - successful push
  - PR URL returned

## RED Evidence

Recorded on 2026-05-21:

- `packages/bridge-cli/README.md` listed only testnet enabled routes and described `doctor` as route-list-only diagnostics.
- `apps/docs/content/users/guides/zeko-bridge.md` linked only `https://bridge.zeko.io` as the Bridge UI and did not distinguish mainnet/testnet.
- `apps/docs/content/developers/getting-started.md` and `packages/layer/nuxt.config.ts` still used `https://alpha.bridge.zeko.io` as the primary testnet bridge link.
- `rg` found the incident document `docs/BRIDGE_INVALID_WITNESSES_INCIDENT_2026-03-05.md` still references `https://api.actions.zeko.io` historically; that document is an incident record, not current endpoint guidance.

## GREEN Evidence

Recorded on 2026-05-21:

- Updated Bridge CLI README to list enabled Mina/Zeko testnet and mainnet routes and expanded `doctor` behavior.
- Updated Bridge SDK README and `.env.example` to use the testnet Actions API for testnet examples.
- Updated Zeko skill endpoint references to distinguish testnet and mainnet Actions API / Bridge UI URLs.
- Updated docs site bridge pages and shared Nuxt layer bridge link to prefer `https://testnet.bridge.zeko.io` for testnet, with `https://alpha.bridge.zeko.io` documented as an alias.
- Full plan validation set passed:
  - `moon run actions-api:test`
  - `moon run actions-api:typecheck`
  - `moon run actions-api:lint`
  - `moon run actions-indexer:test`
  - `moon run actions-indexer:typecheck`
  - `moon run actions-indexer:lint`
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-cli:lint`
  - `moon run bridge-sdk:test`
  - `moon run bridge-sdk:typecheck`
  - `moon run bridge-sdk:lint` completed successfully with existing `src/types.ts` warnings.
  - `moon run bridge-ui:test-ci`
  - `moon run bridge-ui:typecheck`
  - `moon run bridge-ui:lint`
- Additional docs/reference checks passed:
  - `moon run docs:test`
  - `moon run docs:typecheck`
  - `moon run docs:lint`
  - `moon run zeko-skills:validate`
  - `moon run zeko-skills:test`
  - `moon run zeko-skills:typecheck`
  - `moon run zeko-skills:lint`
- `git status --short` was inspected before commit preparation.
