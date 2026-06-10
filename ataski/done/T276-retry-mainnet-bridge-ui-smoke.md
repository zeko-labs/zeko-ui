---
id: T276
title: "Retry mainnet Bridge UI smoke"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-27T09:51:46Z
updated_at: 2026-05-27T09:53:10Z
---

## Requirements

- Investigate `Bridge Mainnet Release` run `26503755169`, which passed Actions services validation and Bridge UI deployment but failed the final smoke check.
- Fix the final Bridge UI smoke step so it tolerates immediate post-deploy custom-domain DNS/readiness propagation instead of failing on a single `curl`.
- Keep the smoke target `https://bridge.zeko.io`.
- Validate the domain is reachable and the workflow shell syntax is sound, then rerun the mainnet release workflow until it succeeds.

## Test Plan

- DDD: use the failed run log showing `Deploy mainnet Bridge UI` completed, Wrangler reported `bridge.zeko.io (custom domain)`, and the immediately following `curl -fsS https://bridge.zeko.io` failed with `curl: (6) Could not resolve host`.
- Confirm `https://bridge.zeko.io` is reachable after propagation.
- Add a retry loop to the smoke step and validate the shell snippet syntax locally.
- After committing and pushing, dispatch `Bridge Mainnet Release` and monitor it to completion.

## RED Evidence

- `Bridge Mainnet Release` run `26503755169` installed `nu`, passed Actions services deployment/validation, and completed `bridge-ui:deploy-mainnet`.
- Wrangler reported `Deployed bridge triggers` with `bridge.zeko.io (custom domain)`.
- The immediately following smoke step failed with `curl: (6) Could not resolve host: bridge.zeko.io`.
- A later local check resolved `bridge.zeko.io` and returned `HTTP/2 200`, indicating a post-deploy DNS/readiness race rather than a failed deploy.

## GREEN Evidence

- Updated `.github/workflows/bridge-mainnet-release.yaml` so `Smoke mainnet Bridge UI` retries `curl -fsS https://bridge.zeko.io` up to 30 times with 10-second sleeps before failing.
- `bash -n` passed for the smoke retry shell snippet.
- `curl -fsSI --max-time 15 https://bridge.zeko.io` returned `HTTP/2 200`.
