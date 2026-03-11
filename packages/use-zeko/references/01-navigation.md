# Navigation

Use this file to orient quickly before answering a Zeko question.

## Best entrypoints

- Public docs: `https://docs.zeko.io`
- Docs machine-readable summary: `https://docs.zeko.io/llms.txt`
- Docs machine-readable full text: `https://docs.zeko.io/llms-full.txt`
- Faucet website: `https://faucet.zeko.io`
- Bridge website: `https://bridge.zeko.io`
- Explorer: `https://zekoscan.io`

## How to route

- User asks how to set up a wallet, get funds, bridge, or inspect activity: go to `10-users.md`.
- User asks how to build a zkApp or app on Zeko: go to `20-build-on-zeko.md`.
- User asks for exact SDK config or bridge operation flow: go to `30-bridge.md`.
- User asks for CLI-based faucet use or machine-readable output: go to `40-faucet.md`.
- User asks for exact GraphQL or proxy URLs: go to `60-networks-and-endpoints.md`.
- User asks how Zeko works internally: go to `70-architecture-and-protocol.md`.

## Public docs map

- Docs sidebar shape is defined in `apps/docs/.vitepress/config.ts`.
- Public narrative docs live under `apps/docs/content/**`.
- The best public onboarding pages are the user getting-started page and the developer getting-started page.

## Important routing caveats

- `apps/docs/content/introduction/quick-start.md` is only a router.
- Several sidebar-linked user-guide pages are WIP or thin. Do not treat sidebar completeness as proof that a workflow is well documented.
- The docs pages for Bridge SDK and Faucet CLI include the package READMEs directly, so the package READMEs are canonical for those workflows.
- If the live `llms.txt` route is misbehaving, prefer `llms-full.txt` and validate the repo `_redirects` file.
