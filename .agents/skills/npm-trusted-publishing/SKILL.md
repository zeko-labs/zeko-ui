# npm Trusted Publishing Setup

Guide for setting up new publishable npm packages in this monorepo using OIDC trusted publishing (no long-lived npm tokens).

## Overview

This monorepo publishes packages to npm using GitHub Actions OIDC trusted publishing. Packages are released through changesets — the orchestrator workflow (`.github/workflows/changesets.yaml`) runs on push to `main`, and downstream release workflows handle per-package build + publish.

## Prerequisites

- npm CLI >= 11.5.1 or Node >= 24 (proto manages this via `.prototools`)
- The npm org (`@zeko-labs`) must exist on npmjs.com
- A user with publish access to the org must be logged in locally (`npm login`)

## Setting up a new publishable package

### 1. Create the release workflow

Create `.github/workflows/release-<name>.yaml` with:

```yaml
on:
  workflow_call:
  workflow_dispatch:
```

The publish job must have these permissions (job-level overrides workflow-level defaults, so both are required):

```yaml
permissions:
  contents: read # needed for actions/checkout
  id-token: write # needed for OIDC trusted publishing
```

Use `moonrepo/setup-toolchain@v0` with `auto-install: true` for tooling. Do NOT configure `.npmrc` or use `NPM_TOKEN` — OIDC handles auth automatically.

Publish with `--provenance --access public`. Use `pnpm publish` which handles `workspace:*` and `catalog:` protocol resolution automatically:

```yaml
- name: Publish
  run: pnpm publish --provenance --access public --no-git-checks
```

### 2. Register the workflow in the changesets orchestrator

Add a job to `.github/workflows/changesets.yaml`:

```yaml
release-<name>:
  name: Release <Name>
  needs: release
  if: needs.release.outputs.hasChangesets == 'false'
  uses: ./.github/workflows/release-<name>.yaml
  secrets: inherit
```

### 3. Add package to changeset config (if private)

If the package has dependencies on other private workspace packages, add all involved private packages to `.changeset/config.json` `ignore` list to avoid validation errors.

### 4. Initial publish (claim package names)

The first publish of any package **cannot** use OIDC — it must be done manually.

Use the init publish script:

```bash
bun scripts/npm-init-publish.ts packages/<name> --otp <code>
```

This script:

- Temporarily sets all package versions to `0.0.0`
- Uses `pnpm publish` which resolves `workspace:*` and `catalog:` protocols automatically
- Publishes platform sub-packages first, then the main package
- Restores original `package.json` files in a `finally` block

The `0.0.0` version ensures no conflict with the real version that changesets will publish.

### 5. Configure trusted publishing on npmjs.com

For **each** published package, go to:

```
https://www.npmjs.com/package/<package-name>/access
```

Under **Trusted Publisher**, configure:

- **Organization**: `zeko-labs` (GitHub org, case-sensitive)
- **Repository**: `zeko-ui` (GitHub repo name)
- **Workflow filename**: `release-<name>.yaml` (the workflow file that runs `npm publish`)

### 6. Verify

Trigger the release workflow manually via `workflow_dispatch` or push a changeset to `main` to test the full pipeline.

## Architecture

```
push to main
  └─ changesets.yaml (orchestrator)
       ├─ changesets/action → creates version PR or skips
       └─ if no pending changesets → triggers downstream:
            └─ release-<name>.yaml
                 ├─ version-check (compare package.json vs registry)
                 ├─ build (if needed, e.g. cross-compilation)
                 ├─ publish (OIDC auth, --provenance)
                 ├─ github-release (optional)
                 └─ sync (optional, for split-repo packages)
```

## Key details

- **Permissions**: Job-level `permissions` in GitHub Actions completely override workflow-level defaults. Always include `contents: read` alongside `id-token: write`, or `actions/checkout` will fail with "repository not found".
- **Version script**: `scripts/changeset-version.ts` runs `pnpm changeset version` then `dprint fmt` to fix JSON formatting that changesets breaks.
- **No NPM_TOKEN**: The entire auth flow is handled by OIDC. No secrets needed for npm publish.
- **Provenance**: The `--provenance` flag is required for trusted publishing to work. It generates and attaches a provenance attestation to the published package.

## Reference: faucet-cli

The `faucet-cli` package is the first package set up with this flow. It has 7 npm packages (1 main + 6 platform binaries) all published from `release-faucet-cli.yaml`. Use it as a reference implementation for future packages.
