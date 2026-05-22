---
id: T264
title: "Resolve review comments and deploy inventory"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-22T12:45:00Z
updated_at: 2026-05-22T13:35:00Z
---

## Requirements

- Fix the remaining Gemini review findings in `apps/bridge-ui/deploy-ci.nu`.
- Resolve the fixed Gemini PR review threads.
- Explain and keep or remove the docs link-check skip for `https://testnet.bridge.zeko.io` based on the CI/deploy sequencing.
- Add a written inventory of required environment variables, secrets, credentials, access, and post-review values needed before live deployment.
- Make the implementation log location explicit in the plan.

## Test Plan

- BDD: validate the Nu deployment script with `nu -n -c 'source apps/bridge-ui/deploy-ci.nu'`; run targeted docs tests with CI enabled; run formatting and diff checks.

## RED Evidence

- Gemini review threads remain unresolved.
- `deploy-ci.nu` still uses `hash sha256 | str substring`, string interpolation for `PATH`, and does not check external command exit codes.
- The plan does not have a dedicated deployment access inventory section.

## GREEN Evidence

- Fixed `apps/bridge-ui/deploy-ci.nu` branch hash encoding, PATH handling, and external command exit-code handling.
- Added `Deployment Access Inventory` and made `Implementation Review Log` explicit in `docs/BRIDGE_MAINNET_READINESS_PLAN.md`.
- `nu -n -c 'source apps/bridge-ui/deploy-ci.nu'` passed.
- `CI=true moon run docs:test -f` passed.
- `moon run bridge-mainnet-readiness-plan:format -f` passed.
- `git diff --check` passed.
