---
id: T134
title: "Create public use-zeko umbrella skill content"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T15:23:20Z
updated_at: 2026-03-11T15:30:30Z
---

## Requirements

- Create one installable umbrella skill under a repo-owned public-facing path, centered on external users and builders who want to use Zeko.
- Keep the root `SKILL.md` short, router-like, and agent-neutral, with concise trigger metadata and direct one-hop links to every reference file.
- Add a flat `references/` tree that covers navigation, user workflows, building on Zeko, bridge usage, faucet usage, o1js/tooling, networks/endpoints, architecture/protocol, troubleshooting/boundaries, and an explicit source-of-truth map.
- Use the canonical Zeko UI sources called out by the user, plus the sibling `../zeko` repo if present, as authority. Prefer linking to upstream docs and canonical files over copying large prose.
- Make the skill clearly o1js-first for zkApp development, point agents to official o1js docs/tooling/MCP, and keep Zeko-specific deltas in the skill.
- Keep contributor-only workflows out of the main skill flow unless they are directly needed to answer user-facing questions.

## Test Plan

- `BDD`: add deterministic structural tests that read the new skill and assert the public navigation/trigger contract, direct-link reference layout, and required source-of-truth coverage.
- RED path before implementation: create failing tests that expect the `use-zeko` skill directory, required reference files, router links, and canonical-source metadata to exist.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because `packages/use-zeko/SKILL.md`, `packages/use-zeko/references/`, and `packages/use-zeko/references/99-source-of-truth.md` do not exist yet. The structural test now defines the required router skill shape and canonical-source coverage before implementation.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed with `3` structural assertions covering the router skill, direct one-hop reference links, and the canonical source-of-truth mapping.
