---
id: T261
title: "Keep Bridge Sentry project compatible"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-22T10:09:16Z
updated_at: 2026-05-22T10:14:02Z
---

## Requirements

- Preserve the Bridge UI Nushell deploy rewrite without adding a new required Cloudflare build secret that the old `deploy-ci.sh` path did not actually need.
- Keep supporting `SENTRY_PROJECT` when present, but default to the existing historical project slug `zeko-bridge`.
- Do not bypass or disable Sentry release work, Cloudflare preview uploads, or CI checks.
- Record the change in the implementation review log because it is an extra compatibility fix discovered from the failing Cloudflare bridge check.

## Test Plan

- Test Strategy Exception: the failure happens in Cloudflare Workers Builds with secret-dependent Sentry deploy behavior, and the repo does not have a local remote-build runner or real Sentry credentials for a no-deploy automated test.
- Validate the pure Nushell project-resolution behavior by sourcing `deploy-ci.nu` and checking the fallback and override values.
- Re-run Bridge typecheck and Wrangler testnet dry-run to verify the deploy target still bundles/upload-checks without live deployment.

## RED Evidence

- The current `deploy-ci.nu` requires `SENTRY_PROJECT` but still passes a hardcoded `zeko-bridge` project to `sentry-cli`.
- The prior shell deploy path used `sentry-cli releases new -p zeko-bridge` and did not read `SENTRY_PROJECT` at runtime.
- Remote `Workers Builds: bridge` still fails after the proto bootstrap, and missing build secret compatibility is a plausible remaining code-side failure.

## GREEN Evidence

- Updated `apps/bridge-ui/deploy-ci.nu` to resolve `SENTRY_PROJECT` with `optional-env "SENTRY_PROJECT" "zeko-bridge"` and use the resolved project for all Sentry release commands.
- `proto run nu -- --commands 'source apps/bridge-ui/deploy-ci.nu; print (optional-env "SENTRY_PROJECT" "zeko-bridge"); with-env { SENTRY_PROJECT: "custom-project" } { print (optional-env "SENTRY_PROJECT" "zeko-bridge") }'` printed `zeko-bridge` and `custom-project`.
- `moon run bridge-ui:typecheck` passed.
- `pnpm exec wrangler versions upload --env testnet --dry-run` from `apps/bridge-ui` passed with the expected existing bundling warnings and testnet bindings.
- `git diff --check` passed.
