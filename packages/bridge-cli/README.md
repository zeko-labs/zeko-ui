# Bridge CLI

Agent-first CLI for bridging assets between Mina and Zeko.

`zeko-bridge` is built for unattended agent use. The primary interface is the single high-level `bridge` command, which signs, submits, waits, retries transient network checks, advances queued claims in order, and streams progress until the requested bridge completes.

Lower-level commands still exist, but they are advanced tools for debugging, recovery, and explicit operator control.

The package is maintained in the private Zeko monorepo and mirrored to [zeko-labs/bridge-cli](https://github.com/zeko-labs/bridge-cli) for public source, issues, and releases.

## Status

Enabled routes:

- `mina:testnet -> zeko:testnet`
- `zeko:testnet -> mina:testnet`

Known but not yet enabled:

- `mina:mainnet -> zeko:mainnet`
- `zeko:mainnet -> mina:mainnet`
- `eth:testnet -> zeko:testnet`
- `zeko:testnet -> eth:testnet`
- `eth:mainnet -> zeko:mainnet`
- `zeko:mainnet -> eth:mainnet`

## Installation

Install globally:

```bash
npm install -g @zeko-labs/bridge-cli
```

Or run it directly:

```bash
npx -y @zeko-labs/bridge-cli bridge --from mina:testnet --to zeko:testnet --amount 1
```

The npm release is a single built JavaScript tarball. There are no platform-specific bridge-cli packages.

## Configuration

The CLI signs transactions from environment variables only in v1.

Required variables:

| Variable                       | Required | Description                                                                                        |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `ZEKO_BRIDGE_MINA_PRIVATE_KEY` | yes      | Mina private key used for Mina-originated bridge actions.                                          |
| `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY` | no       | Zeko private key used for Zeko-originated bridge actions. Falls back to the Mina key when omitted. |
| `ZEKO_BRIDGE_ETH_PRIVATE_KEY`  | no       | Reserved for future Ethereum routes.                                                               |

## Recommended Usage

### `bridge`

Use `bridge` by default. This is the command agents should reach for first.

```bash
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1
zeko-bridge bridge --from zeko:testnet --to mina:testnet --amount 3 --recipient B62q...
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1 --json
```

Flags:

| Flag              | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `--from`          | Source chain reference. Defaults to `mina:testnet`.                                   |
| `--to`            | Destination chain reference. Defaults to `zeko:testnet`.                              |
| `--amount`        | Amount in Mina units.                                                                 |
| `--recipient`     | Optional destination account. Defaults to the account derived from the active signer. |
| `--timeout-slots` | Optional deposit timeout override for Mina-originated bridges.                        |
| `--json`          | Emit the final result as JSON on stdout. Progress continues on stderr.                |

Behavior:

- waits for completion by default
- retries transient bridge status and capability checks
- keeps printing useful progress during long waits without spamming every poll
- advances earlier queued claims in order when the account already has pending bridge work
- writes structured logs to disk for debugging and recovery
- is intended to complete unattended from a single CLI invocation, even when the network wait is very long

### Current Protocol Notes

- Archive queries are most reliable when they scan recent history in roughly `10_000`-block windows instead of using a giant `from=0` range.
- Sequencer proof requests currently live in memory for about 20 minutes. If proving takes longer than that, the sequencer may return `Invalid key`. That case is currently treated as a terminal failure and is not yet automatically recoverable.
- A cancellable deposit can never be finalized.
- Deposit queue behavior is asymmetric:
  - cancellable deposits are skippable
  - finalizable deposits must never be skipped
  - the protocol uses `lastFinalizedDeposit` on L2 and `lastCancelledDeposit` on L1, and only deposits with higher indices than those state values may be claimed
- The CLI does not fully implement cancellable-deposit skipping yet. The current behavior is documented here so operators understand the protocol rule and the current gap.

### JSON Result

`--json` prints a final object like:

```json
{
	"success": true,
	"operation_id": "f3d3d12a-8a1c-4b8b-9a1e-2a6e6bc7a1d7",
	"route": "mina:testnet->zeko:testnet",
	"direction": "deposit",
	"status": "completed",
	"amount": "1",
	"recipient": "B62qexample",
	"submitted_transactions": [
		{ "action": "submit", "hash": "5Jsubmit" },
		{ "action": "finalize", "hash": "5Jfinalize" }
	],
	"final_transaction": {
		"action": "finalize",
		"hash": "5Jfinalize",
		"explorerUrl": "https://zekoscan.io/testnet/tx/5Jfinalize"
	},
	"explorer_urls": ["https://zekoscan.io/testnet/tx/5Jfinalize"],
	"log_path": "/Users/example/Library/Logs/zeko-bridge/f3d3d12a-8a1c-4b8b-9a1e-2a6e6bc7a1d7.jsonl"
}
```

## Advanced Commands

These commands are supported, but they are not the default agent path:

- `deposit` for low-level Mina-to-Zeko submit/finalize/cancel/status control
- `withdrawal` for low-level Zeko-to-Mina submit/finalize/status control
- `operation` for listing, inspecting logs, and resuming persisted operations
- `tui` for viewing active and recent operations in OpenTUI
- `doctor` for checking local paths, signer env status, and known routes

Use them when you need explicit low-level recovery or debugging. If you are simply trying to bridge, use `bridge`.

## Logs And State

The CLI writes:

- persisted operation state under the OS/XDG state directory
- append-only JSONL logs under the OS/XDG log directory

Use `operation logs <operation-id>` to inspect the recorded event stream for a specific bridge.

## Development

Run from the monorepo root:

```bash
moon run bridge-cli:build
moon run bridge-cli:typecheck
moon run bridge-cli:test
moon run bridge-cli:lint
```

Manual live validation instructions live in the internal `packages/bridge-cli/testing.md` document in the monorepo.

Release and mirror details live in the package-level release notes within the monorepo.

## Operator Setup Checklist

Before local live validation or scheduled monitoring can work, make sure all of the following are done:

1. Export funded testnet keys locally so the live validation can be run immediately:

   ```bash
   export ZEKO_BRIDGE_MINA_PRIVATE_KEY='<mina testnet private key>'
   export ZEKO_BRIDGE_ZEKO_PRIVATE_KEY='<optional zeko testnet private key>'
   ```

   Then tell me which direction to run, or run the checks yourself:

   ```bash
   moon run bridge-cli:live-bridge-mina-to-zeko
   moon run bridge-cli:live-bridge-zeko-to-mina
   ```

2. Claim the npm package name with the required first manual publish. npm OIDC cannot create a brand-new package name.

   Log in once:

   ```bash
   npm login
   ```

   Then run the repo helper from the monorepo root with your npm OTP:

   ```bash
   bun scripts/npm-init-publish.ts packages/bridge-cli --otp 123456
   ```

   That script temporarily publishes `@zeko-labs/bridge-cli@0.0.0` so the name is claimed, then restores the working tree.

3. Create the npm trusted publisher relationship for ongoing GitHub OIDC releases.
   There is no supported npm CLI flow for this today; do it once in the npm UI:

   ```bash
   open 'https://www.npmjs.com/package/@zeko-labs/bridge-cli/access'
   ```

   In npm Trusted Publisher, use:
   - GitHub organization: `zeko-labs`
   - repository: `zeko-ui`
   - workflow filename: `changesets.yaml`
   - environment: leave empty unless you intentionally gate releases through a GitHub Environment

   The workflow filename must be `changesets.yaml`, not `release-bridge-cli.yaml`, because npm validates the caller workflow for `workflow_call` releases.

4. Add a Changeset for the first real bridge-cli release from the monorepo root:

   ```bash
   pnpm changeset
   ```

   Choose `@zeko-labs/bridge-cli` and the bump type you want for the first reviewed release.

5. Merge this PR, wait for `changesets.yaml` to open the `release: version packages` PR on `main`, then merge that version PR so the OIDC publish runs automatically.

6. After the first reviewed version is published successfully, remove the accidental `0.0.0` if it is still within npm's unpublish window:

   ```bash
   npm unpublish @zeko-labs/bridge-cli@0.0.0
   ```

   If npm no longer allows unpublish, deprecate it instead:

   ```bash
   npm deprecate @zeko-labs/bridge-cli@0.0.0 "Accidental initial publish. Do not use this version."
   ```

7. Create the Slack bot for validator failures using the manifest at `services/bridge-validator/slack-app-manifest.json`, then capture:
   - `SLACK_BOT_TOKEN`
   - `SLACK_CHANNEL_ID`

8. Deploy the Cloudflare-based validator service through CI.

9. Run the post-deploy secret sync script against the env file that contains the validator secrets:

   ```bash
   bash services/bridge-validator/scripts/push-secrets-from-env.sh /absolute/path/to/.env
   ```

10. Trigger both Cloudflare workflow directions manually once after deploy:

```bash
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"mina-to-zeko"}' --config services/bridge-validator/wrangler.jsonc
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"zeko-to-mina"}' --config services/bridge-validator/wrangler.jsonc
```

11. Confirm the Cloudflare cron trigger remains enabled before expecting recurring Slack alerts.

The validator service reads only:

- `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- optional `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`
