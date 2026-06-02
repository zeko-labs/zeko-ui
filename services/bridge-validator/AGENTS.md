# Bridge Validator Agent Notes

Use [README.md](README.md) for setup and [`packages/bridge-cli/TESTING.md`](../../packages/bridge-cli/TESTING.md) for the manual CLI-side validation instructions.

## What Matters Here

- this service validates the high-level `bridge` command; production uses the latest published CLI, and PR-only validation can opt into source clone/build with `BRIDGE_VALIDATOR_SOURCE_REPOSITORY` plus `BRIDGE_VALIDATOR_SOURCE_REF`
- a Cloudflare cron trigger alternates one workflow instance per schedule so deposit and withdrawal do not contend on the same wallet nonce or queue state
- each workflow runs the CLI inside Cloudflare Sandbox
- success and failure go to Slack with the configured wallet public key, route evidence, final transaction links when available, workflow plus bridge command timing, and stdout/stderr uploaded as Slack text files when diagnostics are present

## How To Run

- Run all Moon tasks from the repo root. Inspect `services/bridge-validator/moon.yml` before running tasks.
- Local gates: `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, and `moon run bridge-validator:build -f`.
- Regenerate Cloudflare types only from Wrangler config: `moon run bridge-validator:type-cf -f`. Never manually edit `worker-configuration.d.ts`.
- Secret sync is `moon run bridge-validator:sync-secrets`.
- Deploy only when explicitly approved: `moon run bridge-validator:deploy`.
- Trigger exactly one deposit run with `moon run bridge-validator:trigger-deposit`.
- Trigger exactly one withdrawal run with `moon run bridge-validator:trigger-withdrawal`.
- With `BRIDGE_VALIDATOR_ENABLED=false`, manually start exactly one deposit or withdrawal through the authenticated Worker surface with `moon run bridge-validator:start-deposit` or `moon run bridge-validator:start-withdrawal`.
- Inspect a running or stuck Workflow with `VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status`. Use the attempt number from `start bridge validation command attempt N`; the task reads `VALIDATOR_API_TOKEN` from the repo `.env`.
- Inspect sandbox runner diagnostics with `VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status-logs`. The task reads `VALIDATOR_API_TOKEN` from the repo `.env`.
- Destroy a stale sandbox with `VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:cleanup`, or set `VALIDATOR_SANDBOX_ID` for a full sandbox id. Never scan all attempts; probing a Cloudflare Sandbox id can create a live container.
- Prefer `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` and `BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY` for Cloudflare validation. Do not rely on shared numbered bridge test keys unless the validator-specific key is absent and the selected wallet is funded and has an acceptable queue state.
- The validator must exercise the latest published `@zeko-labs/bridge-cli` by default; do not pin the CLI version in the service.
- The production validator invokes `zeko-bridge bridge ...` directly inside the container. Do not replace the default path with a local workspace package, a pinned version, `npm exec`, or a direct `node` call.
- When SDK/CLI changes are not published yet, use the explicit source-build path instead of deploying an untestable validator: set `BRIDGE_VALIDATOR_SOURCE_REPOSITORY` and `BRIDGE_VALIDATOR_SOURCE_REF`, sync secrets if `GITHUB_TOKEN` is needed, then trigger exactly one workflow.

## Parallel Work

If you split work with subagents:

- one subagent owns the Mina-to-Zeko workflow path and tests
- one subagent owns the Zeko-to-Mina workflow path and tests
- keep shared route constants, sandbox paths, and Slack formatting in one place so the outputs stay consistent

## Related Docs

- validator setup: [README.md](README.md)
- public CLI contract: [`packages/bridge-cli/README.md`](../../packages/bridge-cli/README.md)
- manual real-network bridge validation: [`packages/bridge-cli/TESTING.md`](../../packages/bridge-cli/TESTING.md)
