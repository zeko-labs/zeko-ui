# Use Zeko

Public Zeko usage skill developed in the private `zeko-ui` monorepo and mirrored to a standalone public repository for external installation.

The source of truth lives in `packages/use-zeko` inside `zeko-ui`. The public mirror is updated from the monorepo by `.github/workflows/sync-use-zeko.yaml`, which reuses the shared standalone sync workflow and force-pushes a clean copy of `packages/use-zeko`.

## What is here

- `SKILL.md` is the router entrypoint for agents.
- `references/` holds the detailed topic branches.
- `evals/prompts.json` defines prompt-based routing checks.
- `src/` contains the validation and eval CLI used by CI.

## Validation

From the monorepo root:

```bash
moon run use-zeko:test
moon run use-zeko:check
```

The scheduled validation workflow is `.github/workflows/use-zeko-skill.yaml` in the monorepo. It validates structure, canonical-source mappings, endpoint values, live public links that are expected to be active, and prompt-based eval cases.

## Public mirror model

- `packages/use-zeko` is the only development location.
- The public repository is a source mirror, not a second place to make changes.
- Monorepo-only setup files are rewritten during sync so the standalone mirror stays clean and installable.
