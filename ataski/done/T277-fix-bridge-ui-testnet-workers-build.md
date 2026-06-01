---
id: T277
title: "Fix Bridge UI testnet Workers Build"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-01T10:03:06Z
updated_at: 2026-06-01T10:32:32Z
---

## Requirements

- Keep Bridge UI automatic `main` deployment pointed at testnet only.
- Attach Cloudflare Workers Builds triggers to the testnet Worker script instead of the mainnet `bridge` script.
- Use the existing `bridge` Worker trigger only as a template when Cloudflare must create missing testnet triggers.
- Include root toolchain and task-runner inputs that can affect Bridge UI deploy execution in the Workers Builds path filters.
- Validate the checked-in Workers Build config and, if Cloudflare credentials are available, publish/sync the remote trigger state.

## Test Plan

- DDD: the RED evidence is the current unreachable `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io` DNS state plus checked-in `apps/bridge-ui/workers-build.jsonc` attaching automatic triggers to `scriptName: "bridge"` while deploying `bridge-ui:deploy-testnet`.
- GREEN path: update `apps/bridge-ui/workers-build.jsonc`, run Cloudflare build config validation/dry-run tasks, then sync/publish remote triggers and trigger the testnet deploy path where credentials permit.

## RED Evidence

- `dig +short alpha.bridge.zeko.io` and `dig +short testnet.bridge.zeko.io` returned no DNS records while `bridge.zeko.io` resolved.
- `apps/bridge-ui/workers-build.jsonc` set `scriptName` to `bridge`, so automatic testnet deploy triggers were attached to the mainnet Worker script.
- The trigger path filters did not include root toolchain/workspace files such as `.prototools`, `.moon/toolchains.yml`, `pnpm-lock.yaml`, or `package.json`.

## GREEN Evidence

- `proto install --yes nu` now resolves the repo-local Nu plugin and `proto regen --config-mode local --yes` creates a working `~/.proto/shims/nu`.
- `node -e "JSON.parse(...)"` validated `apps/bridge-ui/workers-build.jsonc` and `packages/cloudflare-build-config/schema/workers-build.schema.json`.
- `moon run cloudflare-build-config:typecheck cloudflare-build-config:lint -f` passed.
- `moon run cloudflare-build-config:sync-dry-run -- apps/bridge-ui/workers-build.jsonc` showed the desired `bridge-testnet` triggers and stale `bridge` trigger deletions.
- `moon run bridge-ui:publish-cf-build-config` published `bridge-testnet` triggers and deleted the stale automatic triggers from `bridge`.
- `moon exec --ignore-ci-checks bridge-ui:deploy-testnet` deployed `bridge-testnet` successfully with custom domains `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io`.
- Cloudflare API verification showed no remaining Workers Builds triggers on `bridge` and both expected triggers on `bridge-testnet`.
- The first automatic default-branch Workers Build for commit `52466ee71de30be630489e8c819bdfec84a02cf5` triggered correctly and reached `bridge-ui:deploy-testnet`, but failed because the trigger had no build environment variables.
- `workers-build.jsonc` now declares the required build environment variables and `cloudflare-build-config:sync` upserts them without checking secret values into the repository.
- `moon run bridge-ui:publish-cf-build-config` synced the required build environment variables onto both Bridge UI testnet Workers Build triggers.
- A manual rerun of the default-branch Workers Build trigger for commit `52466ee71de30be630489e8c819bdfec84a02cf5` completed with `build_outcome: success`.
- Public DNS for `alpha.bridge.zeko.io` and `testnet.bridge.zeko.io` resolved through `1.1.1.1` and `8.8.8.8`; HTTP checks via Cloudflare edge IP returned 200 for both domains.
