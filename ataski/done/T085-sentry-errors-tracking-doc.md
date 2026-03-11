---
id: T085
title: "SENTRY-ERRORS.md tracking document"
status: todo
blockedBy: []
owner: unassigned
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Create `apps/bridge-ui/SENTRY-ERRORS.md` documenting all triaged errors, their categories, and resolutions.

Categories:

- A: Third-party extension noise → filtered in ignoreErrors
- B: Service worker / notifications → code fix
- C: Network / backend errors → needs further investigation (documented as TODO)
- D: User navigation → filtered
- E: Stale deployment cache → chunk reload plugin
- F: Wallet interaction → QuietError or filter
- G: iOS / WKWebView → needs investigation (documented as TODO)
- H: Application errors → needs investigation (documented as TODO)

Include a table for each category with: Linear ID, Error, Resolution, Status (fixed/filtered/todo).

## Test Plan

Chore/documentation — no automated tests required.

## Test Strategy Exception

Documentation file only; no runtime behavior changes.
