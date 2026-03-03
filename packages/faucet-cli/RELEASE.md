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
│   ├── changesets.yaml      │──── version PR + triggers release
│   ├── release-faucet-cli.yaml ── build + npm publish + GitHub release
│   └── sync-faucet-cli.yaml │──── force-push to mirror
└────────────────────────────┘
```

## Flow

```
1. pnpm changeset        → add changeset in monorepo
2. Push to main           → changesets workflow creates "Version Packages" PR
3. Merge version PR       → changesets workflow detects no pending changesets
                          → calls release-faucet-cli.yaml
                          → version-check skips if already published
                          → builds 6 platform binaries
                          → publishes 7 npm packages
                          → creates GitHub release on zeko-labs/faucet-cli with binaries
                          → sync workflow force-pushes source to public mirror
```

## Versioning with Changesets

All 7 packages are in a `fixed` group (see `.changeset/config.json` at the monorepo root), so their versions always stay in sync.

The `changesets.yaml` workflow runs on every push to `main`:

- **Pending changesets exist** → runs `pnpm changeset version`, opens a "Version Packages" PR.
- **No pending changesets** (version PR was just merged) → triggers `release-faucet-cli.yaml` via `workflow_call`.

This means releases are always driven by changesets — never by arbitrary code pushes.

## Release Workflow

**Workflow**: `.github/workflows/release-faucet-cli.yaml`
**Trigger**: `workflow_call` from changesets, or `workflow_dispatch` for manual override

### 1. `version-check` — skip if already published

Compares the `package.json` version against the npm registry. Skips the release if the version is already published (unless triggered manually via `workflow_dispatch`).

### 2. `build` — cross-compilation matrix

Builds native binaries for 6 targets with `fail-fast: true`:

| Target        | Runner           | Method  |
| ------------- | ---------------- | ------- |
| macOS x64     | `macos-13`       | Native  |
| macOS arm64   | `macos-14`       | Native  |
| Linux x64     | `ubuntu-latest`  | Native  |
| Linux arm64   | `ubuntu-latest`  | `cross` |
| Windows x64   | `windows-latest` | Native  |
| Windows arm64 | `windows-latest` | Native  |

### 3. `publish` — atomic npm publish

Downloads all 6 binary artifacts, copies them into the platform packages (`npm/*/bin/`), resolves workspace/catalog dependencies to real versions, then runs `scripts/publish.mjs` which publishes all 7 packages sequentially.

### 4. `github-release` — release on public mirror

Creates a GitHub release on `zeko-labs/faucet-cli` with platform-specific archives (`.tar.gz` for unix, `.zip` for windows) attached as assets.

## Sync Workflow

**Workflow**: `.github/workflows/sync-faucet-cli.yaml`
**Trigger**: push to `main` touching `packages/faucet-cli/**`, or `workflow_dispatch`

The sync workflow:

1. **Resolves catalog dependencies** — pnpm catalog references like `"vitest": "catalog:"` are replaced with real versions.
2. **Injects `packageManager`** field from the monorepo root.
3. **Generates `pnpm-workspace.yaml`** for the standalone repo.
4. **Force-pushes a single clean commit** to `zeko-labs/faucet-cli` main branch.

This ensures the standalone repo always has a clean, single-commit history representing the current state.

## Creating a Release

### Step 1: Add a changeset in the monorepo

```bash
pnpm changeset
```

Select `@zeko-labs/faucet-cli` and choose the bump type (patch/minor/major). The fixed group bumps all platform packages together.

### Step 2: Push the changeset

```bash
git add .changeset/
git commit -m "chore: bump faucet-cli"
git push
```

### Step 3: Merge the version PR

The changesets workflow creates a PR titled "chore: version packages". Review and merge it.

### Step 4: Automatic build and publish

Once the version PR is merged, the changesets workflow detects no pending changesets, calls the release workflow, which builds all 6 platform binaries, publishes all 7 packages to npm, and creates a GitHub release on `zeko-labs/faucet-cli`.

### Manual release

Trigger `release-faucet-cli.yaml` manually via `workflow_dispatch` to force a release of the current version (bypasses changesets).

## Secrets

| Secret                         | Where    | Purpose                                   |
| ------------------------------ | -------- | ----------------------------------------- |
| `GITHUB_TOKEN`                 | monorepo | Default token for changesets version PRs  |
| `ZEKO_LABS_GH_APP_ID`          | monorepo | GitHub App ID for cross-repo operations   |
| `ZEKO_LABS_GH_APP_PRIVATE_KEY` | monorepo | GitHub App private key                    |
| `NPM_TOKEN`                    | monorepo | npm publish token with provenance support |

## Files Overview

| File                                        | Purpose                                            |
| ------------------------------------------- | -------------------------------------------------- |
| `.changeset/config.json`                    | Fixed version group for all 7 packages             |
| `.github/workflows/changesets.yaml`         | Version PRs + triggers release on version PR merge |
| `.github/workflows/release-faucet-cli.yaml` | Build matrix + npm publish + GitHub release        |
| `.github/workflows/sync-faucet-cli.yaml`    | Force-push source to public mirror                 |
| `packages/faucet-cli/scripts/publish.mjs`   | Atomic npm publish script                          |
