---
id: T352
title: "Align change network copy with target network"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:07:35Z
updated_at: 2026-06-17T05:20:00Z
---

## Requirements

- Fix the layout where the text "Switch your wallet to" is visually misaligned with the target Zeko network label in the Change Network card/button area.
- Keep the existing bridge UI design language and component structure.
- Ensure the copy and network badge/label align cleanly on desktop and narrow widths without overlapping or forcing awkward wrapping.
- Acceptance criteria: the prompt text and target network label share one coherent inline/flex row when space allows and wrap as a grouped phrase when space is constrained.

## Test Plan

- BDD. First add or update a bridge UI component/view-model test or focused render assertion that captures the expected prompt text and target network label relationship.
- RED path: capture the failing assertion or document a test strategy exception if the existing test harness cannot inspect layout semantics meaningfully.
- GREEN path: update markup/CSS and rerun the bridge UI unit tests/typecheck.

## RED Evidence

- `moon run bridge-ui:test -f` fails `bridge-ui-copy.test.ts` because `CurrentOperation.vue` does not contain `class="NetworkPrompt"` or `class="NetworkPromptText"` around the change-network prompt.

## GREEN Evidence

- `moon run bridge-ui:test -f` passed: 21 test files, 105 tests, including the change-network prompt grouping assertion.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
