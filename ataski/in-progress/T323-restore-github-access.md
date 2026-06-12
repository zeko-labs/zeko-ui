---
id: T323
title: "Restore GitHub Access"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-10T15:48:13Z
updated_at: 2026-06-10T15:58:37Z
---

## Requirements

- Restore `ops.zeko.io` Access to GitHub org membership for `zeko-labs`.
- Identify whether the existing GitHub IdP is missing scopes, missing organization approval, or misconfigured in Cloudflare.
- Keep the programmatic Access configuration task capable of configuring GitHub org auth.
- Do not leave Cloudflare account-member auth as the default unless GitHub cannot be completed without an unavoidable manual organization OAuth approval step.

## Test Plan

- DDD: inspect Cloudflare Access IdP/policy state and GitHub organization OAuth restrictions, then apply the smallest Access/GitHub fix that makes GitHub org auth work. If GitHub requires manual OAuth app approval, document the exact blocker and leave a repeatable command path.

## RED Evidence

- User successfully logged in through Cloudflare-account Access, proving the deployed Access app itself works.
- User explicitly requested GitHub org auth, not Cloudflare-account auth.
- The previous GitHub IdP login failed with `Failed to fetch user/group information from the identity provider`, which Cloudflare documents as missing API permissions to communicate with the IdP.
- Cloudflare's GitHub setup guide requires a GitHub OAuth App created under Developer Settings > OAuth Apps and says Cloudflare Access asks for organizations/teams read-only and email read-only permissions.
- The existing Cloudflare GitHub IdP has client ID shape `Iv23...`, which matches GitHub App client IDs, not the documented OAuth App setup.
- GitHub reports the local `Hebilicious` account is an active `admin` member of `zeko-labs`, but the available GitHub API surfaces show no pending OAuth app approval request.
- `CFZT_TOKEN` can manage Access apps/policies/IdPs, but it cannot create Access service tokens for isolated verification.

## GREEN Evidence

- Restored the checked-in `configure-access` default provider to `github`.
- Updated the README so Cloudflare account membership is documented as an explicit fallback, not the default.

## Current Blocker

- I do not have a GitHub OAuth App client ID/client secret for a Cloudflare Access login method owned or approved for `zeko-labs`.
- GitHub's documented OAuth app approval flow is in the organization web UI under Settings > Third-party Access > OAuth app policy, and the available APIs do not expose a pending Cloudflare Access OAuth approval to grant.
- Applying the current GitHub IdP live would likely reintroduce the 400 login error; I left the live app on the working Cloudflare IdP until the GitHub OAuth App/approval issue is corrected.
