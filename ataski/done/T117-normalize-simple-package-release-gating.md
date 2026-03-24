# T117 Normalize simple-package release gating

## Status

- done

## Blocked By

- T116

## Why

- `changesets.yaml` still treats Bridge CLI differently from GraphQL and Bridge SDK.
- Bridge CLI sync and downstream release are gated on reusable-workflow outputs, while GraphQL and Bridge SDK still use the older top-level condition shape.
- The user asked for the simple package release flows to be uniform.

## Requirements

- Make the simple package reusable release workflows expose a consistent `workflow_call.outputs` surface.
- Use those outputs in `changesets.yaml` so top-level downstream jobs follow the same gating pattern across GraphQL, Bridge SDK, and Bridge CLI.
- Preserve current behavior for packages that should skip downstream sync when no release occurs.

## Test Plan

- DDD
- Parse the affected workflow YAML files successfully.
- Verify `release-graphql.yaml` and `release-bridge-sdk.yaml` now expose `should_release` and `version`.
- Verify `changesets.yaml` gates `sync-graphql` and `sync-bridge-sdk` on the corresponding reusable-workflow outputs.

## Notes

- Faucet CLI remains intentionally different because it has platform packaging and artifact fan-in.

## Validation

- Parsed `.github/workflows/changesets.yaml`, `.github/workflows/release-graphql.yaml`, `.github/workflows/release-bridge-sdk.yaml`, and `.github/workflows/release-bridge-cli.yaml` successfully with Ruby YAML.
- Verified `release-graphql.yaml` and `release-bridge-sdk.yaml` now expose `workflow_call.outputs.should_release` and `workflow_call.outputs.version`.
- Verified `changesets.yaml` now gates `sync-graphql` and `sync-bridge-sdk` on the corresponding reusable-workflow `should_release` outputs, matching Bridge CLI.
