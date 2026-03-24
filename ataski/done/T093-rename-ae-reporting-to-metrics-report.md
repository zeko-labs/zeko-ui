---
id: T093
title: "Rename AE reporting to metrics report"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T14:10:05Z
updated_at: 2026-03-12T14:20:58Z
---

## Requirements

- Rename the user-facing AE report naming to "metrics report" across the bridge observability tooling.
- Update Moon task names, report titles, README text, and related script output so the terminology consistently says "metrics report".
- Preserve the live AE query execution behavior; this is a naming cleanup, not a functional rewrite.

## Test Plan

- BDD.
- RED first: identify and remove stale "AE report" user-facing strings from the current tooling.
- GREEN second: run the renamed report commands and confirm they still render the same validated metrics output.

## RED Evidence

- The user-facing command names and report headings still said `ae-report` / `AE Report`, which no longer matched the broader metrics-report framing we want for this workspace.

## GREEN Evidence

- Renamed the Moon tasks to `metrics-report` and `metrics-report-live`.
- Updated the report heading, temp directory naming, and README usage text to consistently say "metrics report".
- `moon run bridge-ui:metrics-report` succeeds and prints the renamed Markdown report.
