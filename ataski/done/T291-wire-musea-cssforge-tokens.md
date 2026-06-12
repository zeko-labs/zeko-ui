---
id: T291
title: "Wire Musea cssforge tokens"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T16:19:45+07:00
updated_at: 2026-06-12T16:31:50+07:00
---

## Requirements

- Add a zeko-ui-side bridge that lets Musea read cssforge design tokens through `tokensPath`.
- Generate a Musea-compatible JSON token file from the existing cssforge/design token source without committing local filesystem paths.
- Preserve enough metadata for Musea browsing and usage scanning while cssforge grows a native Style Dictionary/Musea output.
- Wire Moon tasks so Musea dev/build/typecheck can regenerate the token file from the current design source.

## Test Plan

- DDD: first verify Musea currently reports zero design tokens, then add the generator and `tokensPath` wiring.
- Run the token generation task, Musea typecheck, lint, and build.
- Restart Musea and verify `/__musea__/api/tokens` reports nonzero tokens and the Design Tokens route can load.

## RED Evidence

- `GET /__musea__/api/tokens` currently returns `tokenCount: 0` because `tokensPath` is not configured.

## GREEN Evidence

- `moon run -f musea:tokens` regenerates the cssforge-backed Musea token JSON.
- `moon run -f musea:tokens` leaves the generated cssforge and Musea token files formatter-clean.
- `moon run -f musea:typecheck` passes.
- `moon run -f musea:lint` passes.
- `moon run -f musea:build` passes; the known Vize/Vite Vue alias warning remains documented in the Musea migration notes.
- `GET /__musea__/api/tokens` reports 6 categories and 126 tokens: 92 primitive and 34 semantic.
- `GET /__musea__/api/tokens/usage` reports css variable usage matches for Musea art files.
- The in-app browser loads `/__musea__/tokens` and shows 126 total tokens, 92 primitive tokens, and 34 semantic tokens.
