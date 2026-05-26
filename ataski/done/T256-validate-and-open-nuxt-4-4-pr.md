---
id: T256
title: "Validate and open Nuxt 4.4 PR"
status: done
blockedBy: [T254, T255]
owner: codex
created_at: 2026-05-26T08:07:17Z
updated_at: 2026-05-26T08:07:17Z
---

## Requirements

- Run the relevant Moon validation tasks for Nuxt apps/layer and any package tasks affected by dependency updates.
- Record validation output and unresolved risks in the Ataski task files.
- Ensure all completed Ataski tasks are moved to `done` and tracker entries are committed with the implementation.
- Commit the finished branch, push it to the remote, and open or update a GitHub PR for `branch/nuxt-4-4-prep`.
- If validation, push, or PR creation is blocked, report the concrete blocker.

## Test Plan

- DDD: final validation is command-driven. Use the implementation tasks' GREEN evidence to choose the final validation matrix and include Moon command output summaries in this task.

## RED Evidence

- Final PR publication is still pending after the dependency, UI, and Moon task changes.
- Validation matrix selected from completed work: `:format-all-fix`, active Nuxt app lint/typecheck, active Nuxt app builds, and Moon task inspection for new profile targets.

## GREEN Evidence

- `pnpm i` completed on 2026-05-26 after the final lockfile update. Remaining peer warnings are existing URQL/core and VitePress/Vite peer-range warnings; `rolldown-vite@7.3.1` emits its expected deprecation warning.
- `pnpm list nuxt vite vue vue-router pinia @pinia/nuxt typescript vue-tsc --depth 0 -r --filter @zeko/bridge-ui --filter @zeko/faucet-ui --filter @zeko/leaderboard-ui --filter @zeko/layer` shows active Nuxt projects on Nuxt `4.4.6`, Vue `3.5.34`, Vue Router `5.0.7` where directly used, TypeScript `5.9.3`, and `vue-tsc` `3.3.2` where directly used.
- `moon task bridge-ui:profile`, `moon task faucet-ui:profile`, and `moon task lb-ui:profile` confirm all new profile tasks run `nuxt build --profile`.
- `moon run -f :format-all` passed on 2026-05-26.
- `moon run -f bridge-ui:typecheck faucet-ui:typecheck bridge-ui:lint faucet-ui:lint lb-ui:lint` passed on 2026-05-26.
- `moon run -f bridge-ui:build faucet-ui:build lb-ui:build` passed on 2026-05-26 with Nuxt 4.4.6 and Rolldown-Vite 7.3.1.
