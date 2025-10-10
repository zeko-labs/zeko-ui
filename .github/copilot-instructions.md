# Copilot instructions for this repo

This monorepo hosts Zeko UI apps and libraries. Use these notes to stay productive and avoid common pitfalls.

## Big picture

- Monorepo: pnpm workspaces, Node 24, pnpm 10 (see root `package.json`). Formatting via dprint; prefer `pnpm -w format:fix` before commits.
- Apps and packages:
  - `apps/bridge-ui` (Nuxt 4) – end-user Bridge at bridge.zeko.io. Core logic in XState machines under `apps/bridge-ui/machines/`.
  - `apps/ui` (Nuxt 3) – main zeko website at zeko.io.
  - `packages/layer` – Nuxt layer + UI kit consumed by apps; tokens from `@zeko/design`.
  - `packages/design` – design tokens and theming utilities exported as `@zeko/design`.
  - `packages/bridge-sdk` – TypeScript SDK that talks to Mina (L1) and Zeko (L2) GraphQL endpoints.
  - `apps/faucet` – Cloudflare Worker API.
  - `apps/docs` – Docs site (VitePress).

## Common tasks and commands

To install everything, run `pnpm i` from the root.

Run all command from the root using moon. Project tasks are defined in each project’s `moon.yml`.

## Conventions and patterns

- XState v5 is used. Prefer `assign`/`enqueueActions`.
- Do not edit generated/compiled folders like `.output/` or commit Cloudflare artifacts; use the scripts.

## Integration points

- External services:
  - Mina GraphQL (node + archive) and Zeko GraphQL endpoints are configured in `Bridge.init` (dev/testnet URLs).
  - Auro wallet provider (`@aurowallet/mina-provider`) via `window.mina` for signing/sending; sequencer-paid txs are signed-only, then sent via o1js `Transaction.send()`.
- Cross-app usage: `@zeko/bridge-sdk`, `@zeko/layer`, and `@zeko/design` are imported via `workspace:^` ranges; update them in-place and rebuild consumers. Prefer Moon tasks in dependents to validate changes.

## Language Instructions

- Always use Typescript instead of Javascript
- Always use plain CSS with the latest features available in postcss. Do not use libraries like Tailwind or Bootstrap.
- Always prefer first principles to adding additional libraries. If using a library is necessary, always ask first before adding it, unless the user explicitly ask for a specific library to implement something.

## Nuxt and Vue Instructions

- Match existing coding style.
- Always use composition API with script setup.

## Notes for this monorepo setup

- Bun is only required when running certain scripts; standard builds use Node.
- Prefer Moon over raw pnpm filters for common workflows to keep consistency with CI tasks.
