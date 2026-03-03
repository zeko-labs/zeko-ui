# Changesets

This folder is managed by [@changesets/cli](https://github.com/changesets/changesets).

## Adding a changeset

```bash
pnpm changeset
```

Select the packages you want to bump and the bump type (patch/minor/major).

## Fixed groups

The faucet-cli packages are in a `fixed` group (see `config.json`), so all 7 packages (`@zeko-labs/faucet-cli` + 6 platform packages) are always bumped together.

## Workflow

1. Add a changeset and push to `main` (or merge a PR containing one).
2. The `changesets.yaml` workflow detects pending changesets and creates a "Version Packages" PR.
3. Merge the version PR — the same workflow detects no pending changesets and triggers the release pipeline.
