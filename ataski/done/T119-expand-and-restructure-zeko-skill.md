---
id: T119
title: "Expand and restructure Zeko skill"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:13:41Z
updated_at: 2026-03-11T17:25:28Z
---

## Requirements

- Move the shipped installable skill under a `zeko/` directory so the installed skill entrypoint becomes easier to navigate and less ambiguous.
- Remove the generated `references/copied/` dependency and instead point agents to public Zeko docs pages and official public pages wherever exact syntax or walkthroughs already exist.
- Increase reliance on the public docs site as the primary narrative surface, using stable public docs URLs and curated links that an installed agent can actually open.
- Expand the skill so it is materially more useful to agents: include concrete `curl` examples for GraphQL and operational endpoint discovery, explain the sequencer and archive node at a practical level, and improve routing coverage for common user and builder questions.
- Keep the shipped skill self-contained: no repo-local paths and no references outside the shipped skill directory except public URLs.
- Preserve the existing validation/eval approach, but update it to match the new `zeko/` layout and stronger public-docs-first content.

## Test Plan

- `BDD`: update the structure and validation tests first so the current package fails on the old root layout, the copied-reference tree, and the missing docs-heavy/query-heavy content.
- RED path before implementation: make `moon run use-zeko:test` fail against the current layout and expectations, then implement the content/layout/validator changes until `moon run use-zeko:test` and `moon run use-zeko:check` both pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected after tightening the tests for a `zeko/` skill directory, removing copied references, and requiring richer docs-first/query-first guidance. The previous package still shipped `SKILL.md` at the package root, still used `references/copied/`, still exposed a `sync-sources` task, and did not yet include the required `curl`, sequencer, and archive-node coverage.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed with the new `zeko/` skill layout, the reduced docs-first reference tree, and assertions that require public-docs-heavy routing plus `curl`/sequencer/archive coverage.
- `moon run use-zeko:check`
- Passed end to end after rebuilding the package, validating canonical endpoint strings against repo truth, checking live public links, and running prompt evals for bridge, faucet, wallet, build, and sequencer/archive questions.
