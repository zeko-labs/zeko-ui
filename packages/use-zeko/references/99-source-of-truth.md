# Source of Truth

Use this file to decide which source wins when multiple Zeko references disagree.

## Authority chain by topic

| Topic                               | Primary sources                                                                                                                                                                                    | Notes                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public docs narrative               | `apps/docs/content/**`, `apps/docs/.vitepress/config.ts`, `https://docs.zeko.io/llms.txt`, `https://docs.zeko.io/llms-full.txt`                                                                    | Use for public explanation and site routing. Do not assume every sidebar page is complete. |
| User onboarding                     | `apps/docs/content/users/getting-started.md`                                                                                                                                                       | Best public wallet and faucet onboarding page.                                             |
| Bridge SDK workflow                 | `packages/bridge-sdk/README.md`                                                                                                                                                                    | Canonical SDK usage guide. Docs site includes this README directly.                        |
| Bridge SDK examples                 | `packages/bridge-sdk/examples/*`                                                                                                                                                                   | Secondary examples for method shape. Not endpoint authority.                               |
| Faucet CLI workflow                 | `packages/faucet-cli/README.md`                                                                                                                                                                    | Canonical CLI usage, JSON mode, exit codes, and auth model.                                |
| Faucet API endpoint                 | `packages/faucet-cli/src/api.rs`                                                                                                                                                                   | Canonical claim URL and error handling surface.                                            |
| Faucet worker public domain         | `apps/faucet/wrangler.jsonc`                                                                                                                                                                       | Prefer this over older prose README deployment references.                                 |
| GraphQL package usage               | `packages/graphql/README.md`                                                                                                                                                                       | Use when the user needs package imports or generated documents.                            |
| Zeko and Mina runtime endpoints     | `apps/bridge-ui/machines/helpers.ts`, `services/mina-proxy/wrangler.jsonc`, `services/mina-proxy/worker.ts`, `services/mina-archive-proxy/wrangler.jsonc`, `services/mina-archive-proxy/worker.ts` | Runtime endpoint authority.                                                                |
| GraphQL schema-generation endpoints | `packages/graphql/moon.yml`                                                                                                                                                                        | Tooling endpoint authority. Can intentionally differ from runtime proxy choices.           |
| Actions API public domain           | `services/actions/api/wrangler.jsonc`                                                                                                                                                              | Canonical public domain.                                                                   |
| Public architecture map             | `docs/CODEBASE_MAP.md`                                                                                                                                                                             | High-level system map only. Not a line-by-line behavioral spec.                            |
| Advanced protocol reference         | `../zeko` if present, otherwise `https://github.com/zeko-labs/zeko`                                                                                                                                | Use only for deeper architecture and protocol questions.                                   |

## Sources to treat carefully

- `apps/docs/content/users/guides/**`
- `apps/docs/content/developers/getting-started.md`
- `apps/faucet/README.md`
- `packages/bridge-sdk/examples/*` when endpoint values differ from the README or runtime helper

## Specific conflict rules

- If Bridge SDK examples disagree with the Bridge SDK README on endpoint values, prefer the README and `apps/bridge-ui/machines/helpers.ts`.
- If public prose disagrees with deployment or runtime config on public domains, prefer the relevant `wrangler.jsonc` plus the consuming runtime file.
- If older protocol design docs disagree with `rollup-centralized-spec.md`, prefer `rollup-centralized-spec.md` unless newer code proves otherwise.
