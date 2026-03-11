# Troubleshooting and Boundaries

Use this file to avoid stale or misleading answers.

## What this skill should prioritize

- Public user workflows
- Public builder workflows
- Canonical endpoint values
- Zeko-specific deltas on top of o1js and Mina

## What this skill should not center

- Moon or Proto contributor setup
- Monorepo maintenance
- Internal CI or release machinery
- Operator workflows unless the user explicitly asks for infrastructure details

## Known stale or conflicting areas

- Some user-guide pages under `apps/docs/content/users/guides/**` are WIP or too thin to be sole authority.
- `apps/docs/content/developers/getting-started.md` is useful for outbound links, but includes stale or placeholder items such as older bridge URLs and TBD app references.
- `packages/bridge-sdk/examples/*` still use `http://api.actions.zeko.io/graphql`; prefer the HTTPS value in the README and bridge runtime helper.
- Faucet-related repo files disagree between `devnet.zeko.io/graphql` and `testnet.zeko.io/graphql`; verify when the exact sequencer URL matters.
- The docs deployment currently resolves `llms-full.txt` correctly, but `llms.txt` can redirect-loop at the edge. Validate the local `_redirects` file and prefer `llms-full.txt` if you need a live machine-readable docs snapshot right now.

## Good answering habits

- If the question is about current live URLs or latest product availability, verify them.
- If the question is about o1js semantics, use the official o1js docs instead of restating them from memory.
- If multiple repo files disagree, prefer the explicit authority chain in `99-source-of-truth.md`.
