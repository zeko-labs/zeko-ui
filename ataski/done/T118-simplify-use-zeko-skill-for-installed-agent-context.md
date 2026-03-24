---
id: T118
title: "Simplify use-zeko skill for installed agent context"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T16:04:59Z
updated_at: 2026-03-11T17:02:31Z
---

## Requirements

- Remove repo-local paths and source-file references from the shipped skill content. Nothing in `SKILL.md`, `README.md`, or `references/` may point outside the skill directory.
- Make the skill agent-first, not browser-user-first. Prefer direct key and environment-variable workflows; only mention Auro Wallet when the agent is operating a browser with wallet extension access.
- Keep the skill concise and KISS. Remove the current over-structured boundary/source-of-truth sections and replace them with a smaller, efficient reference tree.
- Treat Zeko gateways as the authoritative default endpoints and Minascan as backup endpoints.
- Do not assume sibling repos or local checkouts exist. Remove all `../zeko` assumptions from shipped skill content.
- Do not duplicate large docs manually when a copied-in canonical README or generated reference inside the skill directory is sufficient. Add a sync process so any mirrored reference content that the skill depends on lives inside `packages/use-zeko`.
- Update tests, validator logic, eval prompts, and mirror docs to enforce the new constraints.

## Test Plan

- `BDD`: add failing tests that forbid shipped references to repo-local paths, forbid `../zeko`, require a reduced reference set, require gateway-first endpoint guidance, and require agent-first usage guidance.
- RED path before implementation: make the current skill fail those tests, then simplify the skill and supporting tooling until `moon run use-zeko:test` and `moon run use-zeko:check` pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because the shipped skill still references the old oversized reference tree, still contains repo-local paths in markdown, lacks the copied-in README references, lacks a source-sync task, and does not yet describe the agent-first private-key workflow.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed with the reduced self-contained skill tree, agent-first guidance, copied-in README references, and public-mirror README assertions.
- `moon run use-zeko:sync-sources`
- Passed and regenerated the copied Bridge SDK and Faucet CLI references inside `packages/use-zeko/references/copied/`.
- `moon run use-zeko:check`
- Passed end to end, including source-sync verification, gateway-first endpoint validation against canonical repo sources, live public-link checks, and prompt-based routing evals for bridge, faucet, browser-wallet, and build-path scenarios.
