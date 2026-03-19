---
id: T105
title: "Validate fee-error followup and open PR"
status: in-progress
blockedBy: [T103, T104]
owner: codex
created_at: 2026-03-19T00:00:00Z
updated_at: 2026-03-19T11:37:46Z
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

- Validation evidence was initially incomplete on the canonical branch until the four required Moon gates were rerun there after merging the fee-error task branches.

## GREEN Evidence

- Merged `branch/T100-remove-bridge-ui-post-submit-terminal-fee-error-paths` and `branch/T101-remove-bridge-cli-post-submit-terminal-fee-error-paths` into `branch/bridge-cli-submit-only-withdrawal-errors`.
- Synced the feature branch with the latest `origin/canonical/bridge-cli` and revalidated the merged branch.
- `moon run bridge-ui:test` passed on the canonical branch with 4 test files and 30 tests passing.
- `moon run bridge-ui:typecheck` passed on the canonical branch.
- `moon run bridge-cli:test` passed on the canonical branch with 17 test files and 83 tests passing.
- `moon run bridge-cli:typecheck` passed on the canonical branch.
