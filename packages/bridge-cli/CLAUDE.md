Start with [AGENTS.md](AGENTS.md).

Then use:

- [README.md](README.md) for the public CLI contract and operator checklist
- [TESTING.md](TESTING.md) for manual live bridge validation
- [RELEASE.md](RELEASE.md) for npm release and mirror flow

Key implementation files:

- `src/commands/bridge.ts` for the durable high-level bridge flow
- `src/core/operation-machine.ts` for bridge state transitions
- `src/core/reporter.ts` for streamed progress and final output
