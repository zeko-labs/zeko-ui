---
id: T278
title: "Docs mainnet WIP cleanup"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-26T22:55:56Z
updated_at: 2026-05-26T23:01:45Z
---

## Requirements

- Remove or replace WIP-only docs pages called out for mainnet readiness.
- Delete thin duplicate developer pages when their content is already covered by stronger destination pages.
- Convert useful section landing pages into concise navigation pages with links to complete guides instead of warnings.
- Remove WIP warning copy from Community & Support.
- Keep the VitePress sidebar free of links to deleted pages.

## Test Plan

- DDD: inspect the current docs source and remove placeholder content first, then validate with the docs project test and build tasks through Moon.

## RED Evidence

- Source inspection found WIP warning blocks in the target docs pages and sidebar entries pointing to placeholder-only developer pages.

## GREEN Evidence

- `moon run docs:test` passed.
- `moon run docs:build` passed.
- `rg -n "WIP|under construction|core-developer-concepts" apps/docs/content apps/docs/.vitepress/config.ts --glob '*.md' --glob '*.ts'` returned no matches.
- Follow-up: deleted `apps/docs/content/operators/troubleshooting.md`, removed it from the sidebar, and redirected the old URL to the operator guides index.
