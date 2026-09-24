---
id: T503
title: "ethereum-facing-app-copy"
status: in-progress
blockedBy: []
owner: root
created_at: 2026-09-24T13:58:01Z
updated_at: 2026-09-24T13:58:01Z
---
## Requirements

Audit remaining zeko-ui user-facing app surfaces, SDK/CLI help and docs, and distinguish actual legacy Mina routes from Ethereum surfaces. Update Ethereum-facing presentation, remove stale product positioning, mark legacy UI clearly without changing route semantics or variables. Preserve genuine Mina token labels on legacy networks. Do not rename packages, methods, environment names or generated schemas. Own non-apps/docs paths; no source internals changes.

All work must be performed in dedicated worktrees. Existing checkout changes belong to other ongoing work. The canonical board is in the ethereum-user-facing feature worktree. Subagents must not edit the board or publish branches.

## Test Plan

BDD for existing observable UI contracts; run affected existing tests and build/typecheck/link checks via the project's Moon tasks after inspecting moon.yml. Preserve link integrity and accurate units. For copy and documentation-only edits the exception below applies. Any new runtime behavior requires test-first evidence before implementation.

## Test Strategy Exception

This task is limited to presentation copy, metadata and documentation with unchanged logic. TDD/DDD do not apply to changed algorithms or domain invariants; adding BDD tests that only mirror static wording would be shallow. Verify with existing rendered UI tests where available, documentation links/build and focused diff review. If runtime behavior changes become necessary, stop and coordinate meaningful RED tests first.

## RED Evidence

Pre-edit scan found current product descriptions of Zeko as a Mina L2 and Mina-oriented onboarding.

## GREEN Evidence

Pending validation.
