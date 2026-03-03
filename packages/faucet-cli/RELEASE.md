# Release Process

The faucet-cli is developed in the private `zeko-ui` monorepo. Changesets, versioning, building, publishing, and GitHub releases all run from the monorepo. The standalone `zeko-labs/faucet-cli` repo is a public source mirror with no CI of its own.

## Architecture

```
zeko-ui (monorepo)                              zeko-labs/faucet-cli (public mirror)
┌────────────────────────────┐                  ┌──────────────────────────┐
│ .changeset/config.json     │                  │ /                        │
│   └── fixed group (7 pkgs) │                  │ ├── src/                 │
│                            │                  │ ├── npm/                 │
│ packages/faucet-cli/       │──── sync ────▶   │ ├── scripts/publish.mjs  │
│   ├── src/                 │  force-push      │ └── package.json         │
│   ├── npm/                 │  clean commit    │                          │
│   ├── scripts/publish.mjs  │                  │ No CI workflows          │
│   └── package.json         │                  │ No .changeset/           │
│                            │                  └──────────────────────────┘
│ .github/workflows/         │
│   ├── changesets.yaml              ── orchestrator (version PR + triggers)
│   ├── release-faucet-cli.yaml      ── build + npm publish
│   ├── github-release-faucet-cli.yaml ── GitHub release on mirror
│   └── sync-faucet-cli.yaml        ── force-push to mirror
└────────────────────────────┘
```

## Flow

```
1. pnpm changeset          → add changeset in monorepo
2. Push to main             → changesets.yaml creates "Version Packages" PR
3. Merge version PR         → changesets.yaml detects no pending changesets
                            → calls release-faucet-cli.yaml
                              → version-check (skip if already on npm)
                              → build 6 platform binaries
                              → pnpm publish all 7 packages
                              → calls github-release-faucet-cli.yaml
                            → sync-faucet-cli.yaml force-pushes source to mirror
```

## Versioning with Changesets

All 7 packages are in a `fixed` group (see `.changeset/config.json` at the monorepo root), so their versions always stay in sync.

The `changesets.yaml` workflow runs on every push to `main`:

- **Pending changesets exist** → runs `pnpm changeset version`, opens a "Version Packages" PR.
- **No pending changesets** (version PR was just merged) → triggers `release-faucet-cli.yaml`.

## Workflows

### `changesets.yaml` — orchestrator

Runs `changesets/action@v1` with `version` only. When `hasChangesets` is false, calls the release and sync workflows as downstream jobs.

### `release-faucet-cli.yaml` — build + publish

Triggered by `workflow_call` (from changesets) or `workflow_dispatch` (manual). Checks if the current version is already on npm, builds 6 platform binaries, publishes via `pnpm publish` (resolves `workspace:` and `catalog:` protocols automatically), then calls the GitHub release workflow.

### `github-release-faucet-cli.yaml` — GitHub release

Creates a GitHub release on `zeko-labs/faucet-cli` with platform-specific archives attached.

### `sync-faucet-cli.yaml` — public mirror

Triggered on push to `main` touching `packages/faucet-cli/**`, by `workflow_call`, or `workflow_dispatch`. Resolves monorepo-specific protocols for the standalone context, then force-pushes a clean orphan commit.

## Creating a Release

### Step 1: Add a changeset

```bash
pnpm changeset
```

Select `@zeko-labs/faucet-cli` and choose the bump type (patch/minor/major). The fixed group bumps all platform packages together.

### Step 2: Push the changeset

```bash
git add .changeset/
git commit -m "release: bump faucet-cli"
git push
```

### Step 3: Merge the version PR

The changesets workflow creates a PR titled "release: version packages". Review and merge it.

### Step 4: Automatic build and publish

Once the version PR is merged, the release pipeline builds binaries, publishes to npm, and creates a GitHub release on `zeko-labs/faucet-cli`.

### Manual release

Trigger `release-faucet-cli.yaml` manually via `workflow_dispatch` to force a release of the current version.

## Secrets

| Secret                         | Where    | Purpose                                  |
| ------------------------------ | -------- | ---------------------------------------- |
| `GITHUB_TOKEN`                 | monorepo | Default token for changesets version PRs |
| `ZEKO_LABS_GH_APP_ID`          | monorepo | GitHub App ID for cross-repo operations  |
| `ZEKO_LABS_GH_APP_PRIVATE_KEY` | monorepo | GitHub App private key                   |
| `NPM_TOKEN`                    | monorepo | npm publish token                        |

## Files Overview

| File                                               | Purpose                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `.changeset/config.json`                           | Fixed version group for all 7 packages       |
| `.github/workflows/changesets.yaml`                | Orchestrator: version PRs + triggers release |
| `.github/workflows/release-faucet-cli.yaml`        | Build matrix + npm publish                   |
| `.github/workflows/github-release-faucet-cli.yaml` | GitHub release on public mirror              |
| `.github/workflows/sync-faucet-cli.yaml`           | Force-push source to public mirror           |
| `packages/faucet-cli/scripts/publish.mjs`          | Atomic pnpm publish script                   |
