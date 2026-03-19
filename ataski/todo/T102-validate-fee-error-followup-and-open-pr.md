---
id: T102
title: "Validate fee-error followup and open PR"
status: todo
blockedBy: [T100, T101]
owner: codex
created_at: 2026-03-19T00:00:00Z
updated_at: 2026-03-19T00:00:00Z
---
## Requirements

- Merge the completed UI and CLI task branches back into `branch/bridge-cli-submit-only-withdrawal-errors`.
- Record RED/GREEN evidence for the fee-error-only followup in the canonical board.
- Run the required validation gates on the canonical feature branch:
  - `moon bridge-ui:test`
  - `moon bridge-ui:typecheck`
  - `moon bridge-cli:test`
  - `moon bridge-cli:typecheck`
- Open a PR from `branch/bridge-cli-submit-only-withdrawal-errors` into `canonical/bridge-cli`.
- Do not target `main`.

## Test Plan

- DDD. Treat failing or absent validation evidence as RED until the merged branch passes the required gates.
- After merges, run the four validation commands above and record the exact outcomes before opening the PR.

## RED Evidence

## GREEN Evidence
