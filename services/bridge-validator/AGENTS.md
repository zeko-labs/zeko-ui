# Bridge Validator Agent Notes

Read [README.md](README.md) before changing or operating this service. It is the source of truth for schedule, env, wallet, Slack, manual commands, and acceptance evidence. Use [`packages/bridge-cli/TESTING.md`](../../packages/bridge-cli/TESTING.md) only for CLI-side live validation methodology.

## Guardrails

- Default runtime must exercise the published `zeko-bridge bridge --json --verbose` command, not a workspace package, `npm exec`, pinned CLI, or direct `node` entrypoint.
- For unpublished SDK/CLI changes, use the explicit source-build path: set `BRIDGE_VALIDATOR_SOURCE_REPOSITORY` and `BRIDGE_VALIDATOR_SOURCE_REF`, sync secrets if `GITHUB_TOKEN` is needed, then trigger one workflow.
- Do not run deposit and withdrawal concurrently with the same wallet; nonce and queue state can contend.
- Do not use cancellation as validator evidence. This service validates high-level deposit and withdrawal completion.
- Do not manually edit `worker-configuration.d.ts`; update `wrangler.jsonc` and run `moon run bridge-validator:type-cf -f`.
- Do not pass `VALIDATOR_API_TOKEN` inline. Operator scripts read it from `.env`.

## Validation

- Use the validation commands in README.
- Deployed acceptance requires one successful deposit workflow and one successful withdrawal workflow through Worker, Workflow, Sandbox, CLI, and Slack.
- Bridge operations are slow. Use long waits, spaced polling, and exact errors; do not infer failure from silence.
