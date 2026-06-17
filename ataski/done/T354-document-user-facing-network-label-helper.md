---
id: T354
title: "Document user-facing network label helper"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:32:09Z
updated_at: 2026-06-17T05:40:15Z
---

## Requirements

- Update the repository codebase documentation to describe the `@zeko/networks` display-label boundary.
- Document that internal nomenclature remains `Zeko-M` and that UI-facing labels must use `formatUserFacingNetworkLabel` or a local re-export such as `formatBridgeNetworkLabel`.
- Acceptance criteria: future bridge UI/network label changes have one clear documented place to look before adding visible labels.

## Test Plan

- BDD. First add or update documentation text, then validate with targeted text search and docs lint if available for the touched doc.
- RED path: record a test strategy exception because docs-only content does not have a failing runtime test; use `rg` evidence that no helper guidance existed before the edit.
- GREEN path: run `rg` to confirm the helper guidance exists and run impacted code tests/typechecks after source changes in sibling tasks.

## RED Evidence

- Test strategy exception: docs-only guidance does not have a meaningful failing runtime test.
- `rg -n "formatUserFacingNetworkLabel|USER_FACING_NETWORK_LABELS" docs/CODEBASE_MAP.md` returned no matches before the documentation update.

## GREEN Evidence

- `rg -n "formatUserFacingNetworkLabel|formatBridgeNetworkLabel" docs/CODEBASE_MAP.md` finds the new display-label boundary guidance.
- `moon run bridge-ui:test -f` passed 22 files / 107 tests.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run networks:test -f` passed 1 file / 10 tests.
- `moon run networks:lint -f` passed.
- `moon run networks:typecheck -f` passed.
