# Bridge Validator Agent Notes

Use [README.md](README.md) for setup and [`packages/bridge-cli/testing.md`](../../packages/bridge-cli/testing.md) for the manual CLI-side validation instructions.

## What Matters Here

- this service validates only the published high-level `bridge` command
- there are exactly two workflows, one per supported direction
- failures go to Slack; success stays in Inngest logs

## Parallel Work

If you split work with subagents:

- one subagent owns the Mina-to-Zeko workflow and tests
- one subagent owns the Zeko-to-Mina workflow and tests
- keep shared event names and Slack formatting in one place so the outputs stay consistent

## Related Docs

- validator setup: [README.md](README.md)
- public CLI contract: [`packages/bridge-cli/README.md`](../../packages/bridge-cli/README.md)
- manual real-network bridge validation: [`packages/bridge-cli/testing.md`](../../packages/bridge-cli/testing.md)
