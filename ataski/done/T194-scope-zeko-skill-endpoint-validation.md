---
id: T194
title: "Scope Zeko skill endpoint validation"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T20:52:10Z
updated_at: 2026-05-08T20:55:27Z
---

## Requirements

- Remove Mina fallback endpoint documentation from the Zeko skill docs.
- Update Zeko skill endpoint specs so they validate only that URLs documented by the skill match deployed public endpoints.
- For Mina gateway endpoints, compare skill documentation against the deployed Cloudflare Worker route configuration in `services/mina-proxy/wrangler.jsonc` and `services/mina-archive-proxy/wrangler.jsonc`.
- Do not make Zeko skill verification assert application consumer defaults such as `apps/bridge-ui/machines/helpers.ts` or schema-generation tasks such as `packages/graphql/moon.yml`.
- Preserve endpoint validation for URLs that are actually documented in the skill.

## Test Plan

- TDD: first update the focused Zeko skill spec/unit tests to assert that Mina gateway checks use only skill docs plus deployed wrangler route config, and that they do not reference bridge UI helpers or GraphQL Moon tasks. Run the focused test to capture RED before implementation.

## RED Evidence

- `moon run zeko-skills:test -f -- spec-and-utils.test.ts` failed after changing the focused expectation: `minaGateway.documentedUrl` was `undefined`, showing `endpointChecks` still used the old consumer-oriented `expected/sources` shape.

## GREEN Evidence

- `moon run zeko-skills:test -f -- spec-and-utils.test.ts` passed.
- `moon run zeko-skills:typecheck -f` passed.
- `moon run zeko-skills:check -f` passed after a transient earlier HTTP 523 from the live `https://testnet.zeko.io/graphql` external link check.
- `rg -n "Mina fallback endpoints|Minascan as a backup|api\\.minascan\\.io|devnet-archive-node-api\\.gcp\\.o1test\\.net|apps/bridge-ui/machines/helpers|packages/graphql/moon\\.yml" packages/zeko-skills` returned no matches.
