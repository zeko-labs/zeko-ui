# Release Process

The faucet-cli uses a two-repo architecture: source lives in the `zeko-ui` monorepo, publishing happens from the standalone `zeko-labs/faucet-cli` repo.

## Architecture

```
zeko-ui (monorepo)                    zeko-labs/faucet-cli (standalone)
┌─────────────────────┐               ┌──────────────────────────┐
│ packages/faucet-cli/ │──── sync ────▶│ /                        │
│                      │               │ ├── .changeset/           │
│ Catalog deps:        │  resolved to  │ ├── .github/workflows/   │
│   "vitest": "catalog:"│ ──────────▶  │ │   └── release.yml      │
│                      │  real versions│ ├── pnpm-workspace.yaml   │
└─────────────────────┘               │ ├── npm/                  │
                                       │ │   ├── darwin-arm64/     │
                                       │ │   ├── darwin-x64/       │
                                       │ │   ├── linux-x64/        │
                                       │ │   ├── linux-arm64/      │
                                       │ │   ├── win32-x64/        │
                                       │ │   └── win32-arm64/      │
                                       │ ├── src/                  │
                                       │ ├── scripts/publish.mjs   │
                                       │ └── package.json          │
                                       └──────────────────────────┘
```

## Sync (monorepo → standalone repo)

**Workflow**: `.github/workflows/sync-faucet-cli.yaml`
**Trigger**: push to `main` touching `packages/faucet-cli/**`

The sync workflow:

1. **Resolves catalog dependencies** — pnpm catalog references like `"vitest": "catalog:"` are replaced with the actual version from the root `pnpm-workspace.yaml` (e.g., `"vitest": "3.2.4"`). This is necessary because the standalone repo does not share the monorepo catalog.
2. **Generates `pnpm-workspace.yaml`** — the standalone repo needs its own workspace definition (declaring `npm/*` as workspace packages for changesets). This file is generated on-the-fly to avoid conflicting with the monorepo root workspace.
3. **Commits these artifacts** locally (not pushed back to the monorepo).
4. **Splits and pushes** `packages/faucet-cli/` to `zeko-labs/faucet-cli` using `monorepo-split`.

## Release (standalone repo)

**Workflow**: `packages/faucet-cli/.github/workflows/release.yml` (synced to standalone repo)
**Trigger**: push to `main` or `workflow_dispatch`

### Versioning with Changesets

The release workflow has three jobs:

#### 1. `changesets` — version management

Uses `changesets/action` to handle versioning:

- **When changesets are pending**: runs `pnpm changeset version` to bump all package versions, commits the changes, and opens a PR titled `chore(faucet-cli): version packages`.
- **When the version PR is merged** (or on `workflow_dispatch`): signals `should_release=true` to trigger the build and publish jobs.

All 7 packages are in a `fixed` group (see `.changeset/config.json`), so their versions always stay in sync.

#### 2. `build` — cross-compilation matrix

Builds native binaries for 6 targets with `fail-fast: true` (if any target fails, all stop):

| Target        | Runner           | Method  |
| ------------- | ---------------- | ------- |
| macOS x64     | `macos-13`       | Native  |
| macOS arm64   | `macos-14`       | Native  |
| Linux x64     | `ubuntu-latest`  | Native  |
| Linux arm64   | `ubuntu-latest`  | `cross` |
| Windows x64   | `windows-latest` | Native  |
| Windows arm64 | `windows-latest` | Native  |

Each build uploads its binary as a GitHub Actions artifact.

#### 3. `publish` — atomic npm publish

Downloads all 6 binary artifacts, copies them into the platform packages (`npm/*/bin/`), then runs `scripts/publish.mjs` which publishes all 7 packages sequentially:

1. Six platform packages (`@zeko-labs/faucet-cli-{platform}`)
2. Main package (`@zeko-labs/faucet-cli`)

Publishing is atomic: if any package fails to publish, the script exits immediately and no further packages are published.

## Creating a Release

### Step 1: Add a changeset in the standalone repo

```bash
pnpm changeset
```

Select `@zeko-labs/faucet-cli` and choose the bump type (patch/minor/major). The fixed group ensures all platform packages are bumped together.

### Step 2: Push the changeset

```bash
git add .changeset/
git commit -m "chore: bump faucet-cli"
git push
```

### Step 3: Merge the version PR

The release workflow creates a PR titled `chore(faucet-cli): version packages`. Review and merge it.

### Step 4: Automatic build and publish

Once the version PR is merged, the release workflow detects the version commit, builds all 6 platform binaries, and publishes all 7 packages to npm.

### Manual release

Trigger the release workflow manually via `workflow_dispatch` to skip the changesets check and publish the current versions.

## Secrets

| Secret                   | Where                  | Purpose                                          |
| ------------------------ | ---------------------- | ------------------------------------------------ |
| `FAUCET_CLI_SPLIT_TOKEN` | `zeko-ui`              | GitHub PAT for pushing to `zeko-labs/faucet-cli` |
| `GITHUB_TOKEN`           | `zeko-labs/faucet-cli` | Default token for changesets PR creation         |
| `NPM_TOKEN`              | `zeko-labs/faucet-cli` | npm publish token with provenance support        |

## Files Overview

| File                                     | Repo       | Purpose                                                 |
| ---------------------------------------- | ---------- | ------------------------------------------------------- |
| `.github/workflows/sync-faucet-cli.yaml` | monorepo   | Syncs source to standalone repo with catalog resolution |
| `.github/workflows/release.yml`          | standalone | Changesets versioning + build matrix + atomic publish   |
| `.changeset/config.json`                 | standalone | Fixed version group for all 7 packages                  |
| `scripts/publish.mjs`                    | standalone | Atomic publish script                                   |
| `moon.yml` (`publish` task)              | both       | `node scripts/publish.mjs` (depends on `build`)         |
