---
id: T160
title: "Validate web-410 after merge and review fixes"
status: done
blockedBy:
  - T159
owner: codex
created_at: 2026-03-30T03:32:59Z
updated_at: 2026-03-30T03:44:11Z
---

## Requirements

- Re-run the relevant bridge-ui validation after the merge and review-fix work lands.
- Record concise RED/GREEN evidence for the final state.
- Commit, push, and update the existing PR once the merged branch is green.

## Test Plan

- BDD.
- RED first: capture any failing validation introduced by the merge or review-fix changes.
- GREEN second: confirm the branch is green and ready for review in the updated PR.

## RED Evidence

## GREEN Evidence

- `moon run bridge-ui:test -f` passes on the merged branch after the review-finding fixes, with all bridge-ui unit coverage green.
- `moon run bridge-ui:typecheck -f` passes after the bridge operations table extraction and Sentry capture simplifications, confirming the merged branch type surface is consistent.
- `moon run bridge-ui:build -f` completes successfully on the merged branch. The only remaining output is the expected local Sentry auth-token warning during release upload, not a build failure.
- The branch is ready for review publication: the merge from `origin/main` is resolved, the validated review findings are fixed, and the updated PR can now be pushed without outstanding bridge-ui regressions.
