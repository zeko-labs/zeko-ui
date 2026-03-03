# Changesets

This folder is managed by [@changesets/cli](https://github.com/changesets/changesets).

## Adding a changeset

```bash
pnpm changeset
```

Select the packages you want to bump and the bump type (patch/minor/major).

## Fixed groups

Packages that distribute platform-specific binaries use `fixed` groups in `config.json` so that the main package and all platform packages are always versioned together:

- **faucet-cli**: `@zeko-labs/faucet-cli` + 6 platform packages

When adding a new package group with platform binaries, add a new `fixed` entry.

## Workflow

1. Add a changeset and push to `main` (or merge a PR containing one).
2. The `changesets.yaml` workflow detects pending changesets and creates a "release: version packages" PR.
3. Merge the version PR — the same workflow detects no pending changesets and triggers per-package release workflows.

Each publishable package has its own release workflow (e.g. `release-faucet-cli.yaml`) that handles building, publishing to npm, and creating GitHub releases. See `changesets.yaml` for the full list.
