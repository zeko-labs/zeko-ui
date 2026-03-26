---
id: T149
title: "Add bridge-cli changeset for timeout submit fix"
status: done
blockedBy: [T148]
owner: codex
created_at: 2026-03-24T15:21:12Z
updated_at: 2026-03-24T15:29:32Z
---

## Requirements

- Add a changeset for the bridge-cli fix that keeps direct deposit submission alive through recoverable mutation failures during `--timeout-slots 1` deposits.
- Scope the release note to the bridge-cli package only unless inspection shows the SDK package also changed for this fix.
- Do not bundle unrelated UI work into this changeset.

## Test Plan

- DDD
- Validate by ensuring the changeset targets the correct package and accurately describes the user-facing CLI behavior change.

## RED Evidence

- The bridge-cli runtime changed for deposit submission retries, but no changeset exists yet.

## GREEN Evidence

- Added `.changeset/slow-bears-bow.md` with a patch release entry for `@zeko-labs/bridge-cli`.
- The changeset describes the user-facing direct deposit retry fix for recoverable mutation failures during short-timeout submissions.
