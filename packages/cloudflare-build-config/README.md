# `@zeko/cloudflare-build-config`

Private monorepo utility for keeping Cloudflare Workers Build trigger settings in
sync with repo-managed config files.

## What It Does

This package makes each `workers-build.jsonc` file the source of truth for a
Worker project's Cloudflare Build trigger configuration.

For every enabled config file, it:

1. Resolves the Worker by `scriptName`.
2. Lists the existing Cloudflare Workers Build triggers for that Worker.
3. Matches triggers by `triggers[].name`.
4. Patches the mutable trigger settings so they match the file.

It updates these trigger fields:

- `build_command`
- `deploy_command`
- `root_directory`
- `branch_includes`
- `branch_excludes`
- `path_includes`
- `path_excludes`

It does not create or delete triggers. If a named trigger is missing remotely,
the command fails so the drift is explicit.

The package is private and only meant to be used from this monorepo.

## Config File

Each Worker project keeps a `workers-build.jsonc` file next to its
`wrangler.jsonc`.

Supported fields:

- `enabled`
  Set to `false` to keep a checked-in config file without syncing it.
- `scriptName`
  The Cloudflare Worker script name to look up.
- `buildCommand`
  Default build command applied to every trigger unless a trigger overrides it.
- `rootDirectory`
  Default root directory applied to every trigger unless a trigger overrides it.
- `triggers`
  Array of trigger definitions.

Each trigger supports:

- `name`
  Must match the existing Cloudflare trigger name exactly.
- `buildCommand`
  Optional per-trigger build command override.
- `deployCommand`
  Required per-trigger deploy command.
- `rootDirectory`
  Optional per-trigger root directory override.
- `branchIncludes`
- `branchExcludes`
- `pathIncludes`
- `pathExcludes`

The schema is checked in at
`packages/cloudflare-build-config/schema/workers-build.schema.json`.

## How It Works

Without arguments, the CLI recursively scans these roots:

- `apps`
- `services`
- `unused`

and syncs every `workers-build.jsonc` it finds.

If you pass one or more paths, it syncs only those files.

Explicit paths are resolved from the monorepo root. That keeps the package-level
Moon task and the per-project Moon tasks consistent even though the sync task
itself runs from `packages/cloudflare-build-config`.

## Requirements

- `CLOUDFLARE_API_TOKEN` must be set.
- `CLOUDFLARE_ACCOUNT_ID` must be set.
- The token must be able to read and update Workers Build triggers.
- The remote Worker and trigger names must already exist.

## Usage

Sync every config in the repo:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
pnpm exec zeko-cloudflare-build-config
```

Preview changes without mutating Cloudflare:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
pnpm exec zeko-cloudflare-build-config --dry-run
```

Sync only one project:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
pnpm exec zeko-cloudflare-build-config apps/faucet/workers-build.jsonc
```

Run the package sync task through Moon:

```bash
moon run cloudflare-build-config:sync -- apps/faucet/workers-build.jsonc
moon run cloudflare-build-config:sync-dry-run -- apps/faucet/workers-build.jsonc
```

Run through a per-project Moon target:

```bash
moon run faucet:publish-cf-build-config
moon run docs:publish-cf-build-config
```

Those Moon tasks call:

```bash
pnpm exec moon run cloudflare-build-config:sync -- apps/<project>/workers-build.jsonc
```

so only that project's config is published while the sync command still runs from
the workspace root.
