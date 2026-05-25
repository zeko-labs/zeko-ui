# Bridge Validator Agent Notes

Use [README.md](README.md) for setup and [`packages/bridge-cli/TESTING.md`](../../packages/bridge-cli/TESTING.md) for the manual CLI-side validation instructions.

## What Matters Here

- this service validates only the published high-level `bridge` command
- a Cloudflare cron trigger creates exactly two workflow instances per schedule
- each workflow runs the published CLI inside Cloudflare Sandbox
- failures go to Slack; success stays in Cloudflare Workflow logs

## How To Run

- Run all Moon tasks from the repo root. Inspect `services/bridge-validator/moon.yml` before running tasks.
- Local gates: `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, and `moon run bridge-validator:build -f`.
- Regenerate Cloudflare types only from Wrangler config: `moon run bridge-validator:type-cf -f`. Never manually edit `worker-configuration.d.ts`.
- Secret sync uses the repo-root `.env`: `services/bridge-validator/scripts/push-secrets-from-env.sh`. It maps `ZEKO_BRIDGE_MINA_PRIVATE_KEY` to the Cloudflare `WALLET_PRIVATE_KEY` secret.
- Deploy only when explicitly approved: `moon run bridge-validator:deploy`.
- Trigger exactly one deposit run from the repo root with `pnpm --dir services/bridge-validator exec wrangler workflows trigger bridge-validator '{"routeKey":"mina-to-zeko"}' --config wrangler.jsonc`.
- Trigger exactly one withdrawal run from the repo root with `pnpm --dir services/bridge-validator exec wrangler workflows trigger bridge-validator '{"routeKey":"zeko-to-mina"}' --config wrangler.jsonc`.
- Inspect a running or stuck Workflow with `curl 'https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=<workflow-instance-id>'`.
- Inspect sandbox runner diagnostics with `curl 'https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=<workflow-instance-id>&logs=1'`.
- The validator must exercise the latest published `@zeko-labs/bridge-cli`; do not pin the CLI version in the service.
- The validator runs `npm --prefer-online exec --package @zeko-labs/bridge-cli@latest -- zeko-bridge ...` inside the container. Do not replace it with a local workspace package, a pinned version, or a direct `node` call that bypasses the published npm binary behavior.

## Parallel Work

If you split work with subagents:

- one subagent owns the Mina-to-Zeko workflow path and tests
- one subagent owns the Zeko-to-Mina workflow path and tests
- keep shared route constants, sandbox paths, and Slack formatting in one place so the outputs stay consistent

## Related Docs

- validator setup: [README.md](README.md)
- public CLI contract: [`packages/bridge-cli/README.md`](../../packages/bridge-cli/README.md)
- manual real-network bridge validation: [`packages/bridge-cli/TESTING.md`](../../packages/bridge-cli/TESTING.md)
