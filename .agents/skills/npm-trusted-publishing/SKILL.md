---
name: npm-trusted-publishing
description: Guide for publishing npm packages from GitHub Actions using OIDC trusted publishing. Use when setting up new publishable packages, debugging npm OIDC auth failures, or configuring trusted publisher workflows.
---

# npm Trusted Publishing (OIDC)

Publish npm packages from GitHub Actions without long-lived tokens using OIDC trusted publishing.

## References

- [npm Trusted Publishing docs](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions)
- [npm/cli#8730 — workflow_call filename mismatch](https://github.com/npm/cli/issues/8730)
- [GitHub OIDC for npm](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-npm)

## Manual steps (human required)

1. **Initial publish**: The first publish of every package must be done manually with `npm login` + OTP. OIDC cannot claim new package names. Use `bun scripts/npm-init-publish.ts packages/<name> --otp <code>`.
2. **Configure trusted publisher on npmjs.com**: For **each** package, go to `https://www.npmjs.com/package/<package-name>/access` → Trusted Publisher and set:
   - Organization: `zeko-labs`
   - Repository: `zeko-ui`
   - Workflow filename: **the caller workflow** (e.g. `changesets.yaml`), NOT the reusable workflow (e.g. `release-faucet-cli.yaml`). See [npm/cli#8730](https://github.com/npm/cli/issues/8730).
3. **Verify**: Trigger the workflow and check that `POST 201` appears in the npm OIDC token exchange logs.

## Critical gotchas

### `workflow_call`: configure the parent workflow as trusted publisher

When a caller workflow (`changesets.yaml`) uses `uses: ./.github/workflows/release-<name>.yaml`, the OIDC token contains the **caller** filename in its claims. npm validates this against the trusted publisher config. You must set the trusted publisher workflow to `changesets.yaml`, not `release-<name>.yaml`.

The caller job must also declare `permissions: { contents: read, id-token: write }` — without this the reusable workflow cannot mint OIDC tokens.

### Use `npm publish`, not `pnpm publish`

`pnpm publish` does not trigger npm's OIDC token exchange. Use `npm publish` directly. If the package uses `workspace:*` or `catalog:` protocols, run `pnpm pack` first (resolves protocols), then `npm publish <tarball>`.

### Step ordering: pnpm before `.npmrc`

pnpm errors with `Failed to replace env in config: ${NODE_AUTH_TOKEN}` if `~/.npmrc` contains `${NODE_AUTH_TOKEN}` and the var is unset. Run `pnpm install` and `pnpm pack` **before** writing `.npmrc`.

### Provenance does not work from private repos

`--provenance` requires a public repo for Sigstore transparency logs. Disable with `NPM_CONFIG_PROVENANCE=false`. Provenance is independent from trusted publishing — OIDC auth works without it.

### Multi-package publishes must be idempotent

When publishing multiple packages, a partial failure leaves some published. On retry, already-published packages fail with `You cannot publish over the previously published versions`. Always check before publishing:

```bash
PUBLISHED=$(npm view "${PKG}@${VERSION}" version 2>/dev/null || echo "")
if [ -n "$PUBLISHED" ]; then echo "Skipping"; continue; fi
npm publish ...
```

### GitHub releases may depend on the packaged tarball artifact

Trusted publishing only covers npm authentication. Some package workflows also have a downstream GitHub release job that attaches the packed tarball to a release in another repo. If a downstream workflow uses `actions/download-artifact`, standardizing the npm publish flow must preserve that artifact producer or intentionally replace the contract.

For example, if `release-<name>.yaml` packs a tarball that `github-release-<name>.yaml` later downloads, keep an `actions/upload-artifact@v4` step after `pnpm pack`:

```yaml
- name: Pack package
  id: pack
  working-directory: packages/<name>
  run: |
    set -euo pipefail
    rm -f ./*.tgz
    pnpm pack
    TARBALL=$(find . -maxdepth 1 -name '*.tgz' -print -quit)
    echo "tarball=${TARBALL#./}" >> "$GITHUB_OUTPUT"

- uses: actions/upload-artifact@v4
  with:
    name: <name>-package
    path: packages/<name>/${{ steps.pack.outputs.tarball }}
    retention-days: 1
```

If you remove the upload without updating the GitHub release workflow, `actions/download-artifact` will fail with `Artifact not found` even though npm publish itself is correct.

## Architecture

```
push to main
  └─ changesets.yaml (caller)
       ├─ changesets/action → version PR or skip
       └─ if no pending changesets:
            └─ release-<name>.yaml (reusable, workflow_call)
                 ├─ version-check
                 ├─ build
                 ├─ publish (OIDC, npm publish)
                 ├─ github-release (optional)
                 └─ sync (optional)
```

## Minimal workflow template

Caller job in `changesets.yaml`:

```yaml
release-<name>:
  needs: release
  if: needs.release.outputs.hasChangesets == 'false'
  permissions:
    contents: read
    id-token: write
  uses: ./.github/workflows/release-<name>.yaml
  secrets: inherit
```

Publish job in `release-<name>.yaml`:

```yaml
publish:
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@v4
    - uses: moonrepo/setup-toolchain@v0
      with: { auto-install: true }
    - run: pnpm install --frozen-lockfile
    - run: pnpm pack
      working-directory: packages/<name>
    - run: |
        echo "registry=https://registry.npmjs.org/" > "$HOME/.npmrc"
        echo "//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}" >> "$HOME/.npmrc"
    - run: npm publish <tarball> --access public --loglevel verbose
      working-directory: packages/<name>
      env:
        NPM_CONFIG_PROVENANCE: "false"
```

## Reference implementation

`faucet-cli`: 7 packages (1 main + 6 platform binaries), `release-faucet-cli.yaml`.
