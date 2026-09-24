---
id: T502
title: "ethereum-product-documentation"
status: in-progress
blockedBy: []
owner: docs_agent
created_at: 2026-09-24T13:58:01Z
updated_at: 2026-09-24T13:58:01Z
---
## Requirements

Update apps/docs public site content and navigation for Zeko as an Ethereum rollup. Rewrite current introductory, user, developer, architecture and operator product explanations to reflect Ethereum settlement, ETH and ERC-20 bridging, MetaMask with the Zeko Snap, and Zeko L2 addresses. Preserve accurate Mina-derived proof/transaction technical references and executable API/CLI identifiers. Clearly identify legacy Mina network operations rather than relabeling real Mina routes as Ethereum. Audit published agent-skill docs only if needed for consistent product descriptions, preserving existing executable commands. Do not change internal identifiers, network endpoints or protocol behavior. Own apps/docs/ only initially; report other needed docs changes to coordinator.

All work must be performed in dedicated worktrees. Existing checkout changes belong to other ongoing work. The canonical board is in the ethereum-user-facing feature worktree. Subagents must not edit the board or publish branches.

## Test Plan

BDD for existing observable UI contracts; run affected existing tests and build/typecheck/link checks via the project's Moon tasks after inspecting moon.yml. Preserve link integrity and accurate units. For copy and documentation-only edits the exception below applies. Any new runtime behavior requires test-first evidence before implementation.

## Test Strategy Exception

This task is limited to presentation copy, metadata and documentation with unchanged logic. TDD/DDD do not apply to changed algorithms or domain invariants; adding BDD tests that only mirror static wording would be shallow. Verify with existing rendered UI tests where available, documentation links/build and focused diff review. If runtime behavior changes become necessary, stop and coordinate meaningful RED tests first.

## RED Evidence

Pre-edit scan found current product descriptions of Zeko as a Mina L2 and Mina-oriented onboarding.

## GREEN Evidence

Pending validation.
