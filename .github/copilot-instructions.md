# Copilot instructions for this repo

This monorepo hosts Zeko UI apps and libraries. Use these notes to become productive quickly and avoid common pitfalls.

## Big picture

- Monorepo: pnpm workspaces, Node 24, pnpm 9 (see `package.json`). Formatting via dprint; prefer `pnpm -w format:fix` before commits.
- Apps/libraries:
  - `apps/bridge-ui` (Nuxt 4) – end-user Bridge at bridge.zeko.io. Core logic in XState machines under `apps/bridge-ui/machines/`.
  - `apps/ui` (Nuxt 3) – main zeko website at zeko.io.
  - `apps/layer` – Nuxt layer + UI kit consumed by apps; tokens from `@zeko/design`.
  - `apps/design` – Zeko design elements `@zeko/design`.
  - `apps/bridge-sdk` – TypeScript SDK that talks to Mina (L1) and Zeko (L2) GraphQL endpoints.
  - `apps/faucet` – Cloudflare Worker API; bun-based container; uses KV.
  - `apps/docs` – Docs worker.

## Common tasks and commands

- Install (root):
  - `pnpm i` (uses workspace ranges; patches gql.tada for the SDK).
- Bridge UI dev:
  - `pnpm --filter @zeko/bridge-ui dev` (Nuxt 4). For Cloudflare preview: build with `NITRO_PRESET=cloudflare_module` then `wrangler dev` (`dev:cf`).
- UI dev (Nuxt 3):
  - `pnpm --filter @zeko-ui/webapp dev`.
- SDK build and GraphQL types (requires bun):
  - `pnpm --filter @zeko/bridge-sdk i && bun run build`
  - `bun run schema:get` to refresh GraphQL schema/types (`gql.tada`).
- Faucet worker:
  - `pnpm --filter @zeko/faucet dev` or use `wrangler` scripts in that folder.

## Conventions and patterns

- Networks are string unions: `mina:devnet|mina:mainnet|zeko:testnet|zeko:mainnet`; mainnet is currently disabled in `bridge.ts`.
- Amounts/fees are in MINA, scaled by `10e8` before converting to `UInt64` (see `bridgeOperation.ts`).
- XState v5 is used. Prefer `assign`/`enqueueActions`.
- Do not edit generated/compiled folders like `.output/` or commit Cloudflare artifacts; use the scripts.
- UI components in `apps/layer/components` consume design tokens from `@zeko/design` (e.g., `Label.vue` binds theme colors and fonts). Follow this pattern for new atoms.

## Integration points

- External services:
  - Mina GraphQL (node + archive) and Zeko GraphQL endpoints are configured in `Bridge.init` (dev/testnet URLs).
  - Auro wallet provider (`@aurowallet/mina-provider`) via `window.mina` for signing/sending; sequencer-paid txs are signed-only and then sent via o1js `Transaction.send()`.
- Cross-app usage: `@zeko/bridge-sdk`, `@zeko/layer`, and `@zeko/design` are imported via `workspace:^` ranges; update them in-place and rebuild consumers.

## Language Instructions

- Always use Typescript instead of Javascript
- Always use plain CSS with the latest features available in postcss. Do not use libraries like Tailwind or Bootstrap.
- Always prefer first principles to adding additional libraries. If using a library is necessary, always ask first before adding it, unless the user explicitly ask for a specific library to implement something.

## Nuxt and Vue Instructions

- Match existing coding style.
- Always use composition API with script setup.
