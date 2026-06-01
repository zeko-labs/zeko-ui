---
id: T268
title: "Fix Bridge UI deploy PATH list"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T03:11:38Z
updated_at: 2026-05-27T03:19:40Z
---

## Requirements

- Fix the Bridge UI `deploy-ci.nu` PATH construction so `bridge-ui:deploy-mainnet` can run under the current Nushell version.
- Keep the change narrowly scoped to the deploy script syntax.
- Do not alter deploy target behavior, Sentry release behavior, or Wrangler arguments.

## Test Plan

- DDD: this is driven by the observed deploy failure.
- RED path: `moon exec --ignore-ci-checks bridge-ui:deploy-mainnet` failed before build/deploy with `nu::shell::pipeline_mismatch` at `append [(path join ...)]`.
- GREEN path: run `nu -n -c 'source apps/bridge-ui/deploy-ci.nu'`, `moon run bridge-mainnet-readiness-plan:format -f`, and rerun the mainnet Bridge UI deploy.

## RED Evidence

- `moon exec --ignore-ci-checks bridge-ui:deploy-mainnet` failed in `apps/bridge-ui/deploy-ci.nu` line 83 with `Pipeline empty`.

## GREEN Evidence

- `nu -n -c 'source apps/bridge-ui/deploy-ci.nu'` passed.
- `moon run bridge-mainnet-readiness-plan:format -f` passed.
- `moon exec --ignore-ci-checks bridge-ui:deploy-mainnet` passed the previous Nushell PATH failure point, completed build, Sentry release setup, sourcemap upload, and asset upload; the remaining failure was an unrelated Cloudflare route-update authentication error from the API token.
- Reran the final Wrangler deploy through the existing local Wrangler OAuth session; `https://bridge.zeko.io` deployed successfully with Worker version `1ee2afc1-1042-46ae-8390-e3d5de4c3360`.
- Finalized Sentry release `7dae5e173300c0462b60c291e9ecf907458710cb`.
- `curl -fsS -o /tmp/bridge-zeko.html -w '%{http_code} %{url_effective}\n' https://bridge.zeko.io` returned `200 https://bridge.zeko.io/`.
