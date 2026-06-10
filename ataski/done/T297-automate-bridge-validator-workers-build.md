---
id: T297
title: "Automate bridge validator Workers Build"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T07:43:34Z
updated_at: 2026-06-10T07:48:17Z
---

## Requirements

- Add the bridge validator to the repository's Cloudflare Workers Builds configuration so main-branch changes deploy through CI instead of relying on manual Wrangler deploys.
- Keep the production Worker script name as `bridge-validator`.
- Deploy only from the default branch for this validator; do not add preview deploys unless the service has an explicit preview Worker strategy.
- Preserve schedule flexibility: do not add tests, docs, or types that assert a fixed cron schedule.
- Use existing Moon and Cloudflare build-config patterns.

## Test Plan

- BDD: validate the checked-in Workers Build config with `cloudflare-build-config:sync-dry-run` before and after the change. The RED path is that no validator Workers Build config exists, so the validator cannot be synced/deployed by the standard Workers Builds mechanism.
- GREEN validation will run the dry-run sync task for the new config, plus the bridge-validator build/typecheck path needed by the deploy command.

## RED Evidence

- `rg -n "bridge-validator" services/bridge-validator/workers-build.jsonc services/bridge-validator/moon.yml`: failed because `services/bridge-validator/workers-build.jsonc` did not exist; `moon.yml` had runtime tasks but no `publish-cf-build-config` target.

## GREEN Evidence

- `pnpm i`: succeeded from the root `main` worktree and made Wrangler resolvable through the normal repo dependency path.
- Removed the old merged validator worktree after confirming it was clean.
- `moon run bridge-validator:type-cf -f`: passed from the main worktree.
- `moon run bridge-validator:build -f`: passed.
- `moon run bridge-validator:typecheck -f`: passed.
- `moon run bridge-validator:test -f`: passed, 4 files / 37 tests.
- `moon run bridge-validator:lint -f`: passed.
- `CLOUDFLARE_API_TOKEN="$CFB_TOKEN" CLOUDFLARE_ACCOUNT_ID="a12d2915bc16ee8550f19399839623f7" moon run cloudflare-build-config:sync-dry-run -- services/bridge-validator/workers-build.jsonc`: first reported `would create Deploy default branch`.
- `CLOUDFLARE_API_TOKEN="$CFB_TOKEN" CLOUDFLARE_ACCOUNT_ID="a12d2915bc16ee8550f19399839623f7" moon run bridge-validator:publish-cf-build-config`: initially failed until `triggerTemplateScriptName` was added, then succeeded and created the `Deploy default branch` Workers Build trigger for `bridge-validator`.
- `CLOUDFLARE_API_TOKEN="$CFB_TOKEN" CLOUDFLARE_ACCOUNT_ID="a12d2915bc16ee8550f19399839623f7" moon run bridge-validator:publish-cf-build-config`: after replacing the nested Moon invocation with the direct `zeko-cloudflare-build-config` bin, succeeded and reported the trigger already matches.
- Re-running the dry-run after publish reported `Deploy default branch already matches`.
- `git diff --check`: passed.
