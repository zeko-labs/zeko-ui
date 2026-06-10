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
4. Creates missing triggers with `CLOUDFLARE_BUILD_TOKEN_UUID` and
   `CLOUDFLARE_REPO_CONNECTION_UUID` from the process environment.
5. Patches the mutable trigger settings so they match the file.
6. Deletes moved trigger names from `pruneScriptNames` when configured.
7. Upserts configured trigger build environment variables.
8. When requested with `--trigger-builds`, starts matching Workers Builds for
   the current `GITHUB_REF_NAME` and `GITHUB_SHA`.

It updates these trigger fields:

- `build_command`
- `deploy_command`
- `root_directory`
- `branch_includes`
- `branch_excludes`
- `path_includes`
- `path_excludes`
- build environment variables declared in `environmentVariables`

It deletes triggers only from script names explicitly listed in
`pruneScriptNames`. If a named trigger is missing remotely and the creation UUID
environment variables are not set, the command fails so the drift is explicit.

The package is private and only meant to be used from this monorepo.

## Config File

Each Worker project keeps a `workers-build.jsonc` file next to its
`wrangler.jsonc`.

Supported fields:

- `enabled`
  Set to `false` to keep a checked-in config file without syncing it.
- `scriptName`
  The Cloudflare Worker script name to look up.
- `pruneScriptNames`
  Optional Worker script names to remove same-named triggers from after syncing
  `scriptName`. Use this when moving triggers between Worker scripts.
- `environmentVariables`
  Optional build-time environment variables applied to every trigger. Each value
  can either be a checked-in literal with `value` or be read from the sync
  process environment with `valueFromEnv`. Set `secret: true` for sensitive
  values.
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
- `environmentVariables`
  Optional per-trigger environment variables. These are merged on top of the
  top-level `environmentVariables`.

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
- `CLOUDFLARE_BUILD_TOKEN_UUID` must be set when the sync needs to create a
  missing trigger.
- `CLOUDFLARE_REPO_CONNECTION_UUID` must be set when the sync needs to create a
  missing trigger.
- The token must be able to read, create, update, and delete Workers Build triggers.
- The remote Worker must already exist.
- Existing trigger names must match the checked-in config. Missing trigger names
  are created only when the creation UUID environment variables are set.

## Usage

Sync every config in the repo:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_BUILD_TOKEN_UUID=...
export CLOUDFLARE_REPO_CONNECTION_UUID=...
moon run cloudflare-build-config:sync
```

Preview changes without mutating Cloudflare:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
moon run cloudflare-build-config:sync-dry-run
```

Sync only one project:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_BUILD_TOKEN_UUID=...
export CLOUDFLARE_REPO_CONNECTION_UUID=...
moon run cloudflare-build-config:sync -- apps/faucet/workers-build.jsonc
```

Dump trigger creation UUIDs from an existing Cloudflare Build trigger:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
moon run cloudflare-build-config:dump-tokens -- actions-api "Deploy default branch"
```

The command prints shell exports:

```bash
export CLOUDFLARE_BUILD_TOKEN_UUID=...
export CLOUDFLARE_REPO_CONNECTION_UUID=...
```

Run the package sync task through Moon:

```bash
moon run cloudflare-build-config:sync -- apps/faucet/workers-build.jsonc
moon run cloudflare-build-config:sync-dry-run -- apps/faucet/workers-build.jsonc
```

Trigger matching Workers Builds after a successful sync:

```bash
GITHUB_REF_NAME=main GITHUB_SHA=<commit-sha> moon run cloudflare-build-config:sync -- apps/faucet/workers-build.jsonc --trigger-builds
```

The GitHub Actions sync workflow uses this mode for non-dry-run syncs so config
changes that do not match the Worker's own path filters still start the affected
build.

Dump token UUIDs through the package Moon task:

```bash
moon run cloudflare-build-config:dump-tokens -- actions-api "Deploy default branch"
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
