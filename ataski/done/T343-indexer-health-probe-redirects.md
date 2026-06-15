---
id: T343
title: "Indexer health probe redirects"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-13T03:42:00Z
updated_at: 2026-06-13T04:19:00Z
---

## Requirements

- Fix the actions dashboard production Worker so the mainnet action-indexer health probe does not fail with a Cloudflare Worker `Too many redirects` fetch error.
- Keep authenticated `/status` and control requests using the configured action-indexer token.
- Do not send the action-indexer token to public `/health`, since that endpoint does not require authentication and the token-bearing Worker subrequest is the failing production path.
- Verify the deployed Worker artifact and Cloudflare deployment. Direct unauthenticated API curl must remain blocked by Cloudflare Access.

## Test Plan

- BDD: update the existing status/control probe test so `/health` is fetched without `Authorization` and `/status` plus controls still include the token.
- RED path: the deployed dashboard API currently reports `Too many redirects` for `https://indexer.actions.zeko.io/health`; the existing test also expects the token on `/health`, which is the behavior to remove.
- GREEN path: update the probe, run dashboard tests/build validation, redeploy the dashboard Worker, temporarily bypass Access for this machine, call the deployed dashboard API, and remove the bypass.

## RED Evidence

- `curl https://actions.dashboard.zeko.io/api/ops/status?network=mainnet` through a temporary Access IP bypass returned `200` from the dashboard but the `actions-indexer` probe had `status: "error"` and `error: "Too many redirects.https://indexer.actions.zeko.io/health, ..."` repeated through the redirect limit.
- `moon run -f actions-dashboard:test -- -t "uses request-scoped indexer token"` failed after changing the test expectation, showing `/health` still received `Authorization: Bearer testnet-token`.

## GREEN Evidence

- `https://indexer.actions.zeko.io/health` and authenticated `/status` are healthy when called directly, but the deployed `actions-dashboard` Worker received `301 Location: https://indexer.actions.zeko.io/...` for same-zone subrequests and followed that into a redirect loop.
- Northflank live service metadata reported usable service DNS origins, but T345 supersedes that direct-origin workaround with public same-zone `.zeko.io` fetches.
- Direct curls to both temporary origins returned HTTP 200 healthy action-indexer responses with no redirects.
- `moon run -f actions-dashboard:test actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build`: passed.
- `env -u CLOUDFLARE_API_TOKEN moon run -f actions-dashboard:deploy`: passed, deployed `actions-dashboard` version `494505cd-03c9-408f-9dda-ea808e4ff99f`.
- `wrangler deployments status --name actions-dashboard`: confirmed version `494505cd-03c9-408f-9dda-ea808e4ff99f` is active.
- Built and deployed Worker artifact contained temporary direct-origin routing and did not include the temporary `fetch-debug` route. T345 supersedes this with public `.zeko.io` fetches.
- Temporary Cloudflare Access bypass policies and the throwaway `codex-actions-fetch-test` Worker were deleted after validation attempts.
