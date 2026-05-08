---
id: T193
title: "Replace devnet L1 endpoints with Zeko proxies"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T20:25:28Z
updated_at: 2026-05-08T20:30:08Z
---

## Requirements

- Replace consumer-facing Mina devnet daemon URL usage of `https://api.minascan.io/node/devnet/v1/graphql` with `https://gateway.mina.devnet.zeko.io`.
- Replace consumer-facing Mina devnet archive URL usage of `https://api.minascan.io/archive/devnet/v1/graphql` and `https://devnet-archive-node-api.gcp.o1test.net` with `https://gateway.mina.archive.devnet.zeko.io`.
- Update runtime defaults, tests, examples, docs, and repository workflow/config references discovered by literal search.
- Do not rewrite historical Ataski evidence files unless they are part of this task.
- Preserve proxy worker upstreams only if replacing them would make a deployed proxy recursively call itself.

## Test Plan

- TDD for endpoint defaults and spec assertions: first run the focused tests that cover bridge CLI SDK config and zeko skill endpoint expectations to capture existing failures against the new expected proxy URLs.
- Test Strategy Exception for repository-wide literal replacement: these are configuration/documentation/static endpoint literals spread across env examples, docs, and workflow commands. A test-first harness for every text literal would be disproportionate; validation will use literal search to prove the stale consumer-facing URLs no longer remain outside historical Ataski files and any intentionally preserved proxy upstreams.

## RED Evidence

- `moon run bridge-cli:test -f -- sdk-config.test.ts` failed after updating the focused expectation: `createSdkConfig` returned `https://api.minascan.io/node/devnet/v1/graphql` instead of `https://gateway.mina.devnet.zeko.io`.
- `moon run zeko-skills:test -f -- spec-and-utils.test.ts` failed after updating the endpoint-spec expectation: `endpointChecks` still expected `gateway.mina.devnet.zeko.io` as a host-only pattern and did not yet track the full proxy URL across consumer sources.

## GREEN Evidence

- `moon run bridge-cli:test -f -- sdk-config.test.ts` passed: 3 tests.
- `moon run zeko-skills:test -f -- spec-and-utils.test.ts` passed: 3 tests.
- `moon run zeko-skills:check -f` passed, including endpoint validation.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run lb-indexer:build -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- Literal search for the stale devnet daemon/archive endpoints outside historical Ataski files now returns only `services/mina-proxy/worker.ts` and `services/mina-archive-proxy/worker.ts`; those are proxy upstream targets, and replacing them with the gateway hostnames would make the gateway workers fetch themselves.
