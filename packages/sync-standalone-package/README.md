# Sync Standalone Package

Tooling package used by CI to prepare monorepo packages for standalone mirror repos.

It rewrites monorepo-specific dependency specifiers (`catalog:` and `workspace:`), injects `packageManager`, writes standalone `pnpm-workspace.yaml`, scaffolds `.moon/workspace.yml` + `.moon/toolchains.yml`, and strips root-level `dependsOn` from the synced package `moon.yml`.

## CLI

Build the package first:

```bash
moon sync-standalone-package:build
```

Run the CLI:

```bash
node packages/sync-standalone-package/dist/cli.js \
  --package-dir "packages/faucet-cli" \
  --project-id "faucet-cli" \
  --workspace-packages ".,npm/*"
```

### Arguments

- `--package-dir` required: package path in the monorepo
- `--project-id` required: standalone Moon project id
- `--workspace-packages` optional: comma or newline separated values for standalone `pnpm-workspace.yaml` (default `.`)
- `--extra-workspace-version-sources` optional: comma or newline separated package.json paths used to resolve `workspace:` versions outside the package dir
- `--pin-dev-catalog-versions` optional: pin catalog-derived `devDependencies` to exact versions (`true` by default)

## Validation

```bash
moon sync-standalone-package:typecheck
moon sync-standalone-package:test
```
