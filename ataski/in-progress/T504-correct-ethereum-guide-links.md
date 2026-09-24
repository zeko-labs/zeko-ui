---
id: T504
title: "correct-ethereum-guide-links"
status: in-progress
blockedBy: [T502, T503]
owner: root
created_at: 2026-09-24T14:14:31Z
updated_at: 2026-09-24T14:14:31Z
---
## Requirements

Fix links introduced or retained in the app, package README and public agent-guide copy that use nonexistent current documentation routes. Preserve the existing docs route names. Use /users/guides/zeko-bridge, /users/getting-started, and /users/guides/dapp as appropriate. Work in the isolated ethereum-app-copy task worktree. Do not change runtime logic or protocol identifiers.

## Test Plan

BDD: verify the reader's destination exists in the generated docs site. Review found broken route targets before source edits. Validate links against the rendered documentation output, including absolute links from Vue templates and transcluded package/skill markdown; run existing relevant docs/skill tests as needed. No shallow source-string tests.

## RED Evidence

Independent review identified new /users/guides/using-zeko-bridge and /users/guides/getting-started links with no built pages or redirects; existing docs link tests do not cover these Vue/transcluded sources. Correct output pages are /users/guides/zeko-bridge.html and /users/getting-started.html.

## GREEN Evidence

Pending validation.
