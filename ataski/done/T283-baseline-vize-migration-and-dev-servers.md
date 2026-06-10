---
id: T283
title: "Baseline Vize migration and dev servers"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T00:00:00+07:00
updated_at: 2026-06-10T00:00:00+07:00
---

## Requirements

- Record the current branch commit in `docs/vize-migration.md` before changing package or Nuxt configuration.
- Establish a baseline for existing Nuxt dev servers on this branch.
- Install dependencies as needed after the previous `node_modules` cleanup, using repository package manager and Moon workflows.
- Preserve existing Moon entrypoints and do not add package scripts as workflow entrypoints.

## Test Plan

- DDD: capture the current configuration and run existing dev server commands first, then use that evidence to decide the minimal Vize integration path.
- Run the narrowest Moon dev/prepare commands needed to prove the current Nuxt apps can start before Vize changes.

## RED Evidence

## GREEN Evidence

- `pnpm install` completed and generated Nuxt types for `packages/layer`, `apps/faucet-ui`, `apps/leaderboard-ui`, and `apps/bridge-ui`.
- `moon run faucet-ui:dev` started Nuxt at `http://localhost:3080/`.
- `moon run lb-ui:dev` started Nuxt at `http://localhost:3069/`.
- `moon run bridge-ui:dev` started Nuxt at `http://localhost:3090/`.
