---
id: T122
title: "Add inline o1js Node script guidance"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T01:37:53Z
updated_at: 2026-03-12T01:41:08Z
---

## Requirements

- Add agent-facing guidance that inline Node scripts can be useful for more complex Zeko tasks when `o1js` is available locally.
- Tell the agent that having `o1js` installed in the current working directory is useful when it wants to run inline Node scripts that import `o1js`.
- Include at least one inline Node example that imports `o1js` and does something practical for Zeko, such as value conversion, key derivation, or network/account inspection.
- Keep the guidance in the shipped skill and update tests/evals so it stays discoverable.

## Test Plan

- `BDD`: add failing expectations that require inline `node --input-type=module` examples and explicit `o1js` import guidance in the shipped references.
- RED path before implementation: make `moon run use-zeko:test` fail against the current content, then add the inline `o1js` guidance until `moon run use-zeko:test` and `moon run use-zeko:check` pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because `references/50-build-on-zeko.md` still had no inline `node --input-type=module` examples, no explicit `o1js` import example, and no note that having `o1js` installed in the current directory is useful for ad hoc agent scripts.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed after adding inline `node --input-type=module` examples that import `o1js`, plus explicit guidance that having `o1js` installed in the current directory is useful for ad hoc agent scripts.
- `moon run use-zeko:check`
- Passed end to end with the new inline `o1js` guidance included in structure checks, external-link validation, endpoint checks, and prompt eval coverage.
