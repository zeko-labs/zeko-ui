# Zeko Bridge SDK

This package is developed in the private `zeko-ui` monorepo and mirrored here for public releases. The docs site reuses this README so package docs and website docs stay aligned.

TypeScript SDK for interacting with the Zeko bridge and coordinating deposits and withdrawals between Mina (L1) and Zeko (L2).

## Installation

Install with npm:

```bash
npm install @zeko-labs/bridge-sdk
```

Or with pnpm:

```bash
pnpm add @zeko-labs/bridge-sdk
```

## Quick Start

Initialize a bridge client with the network GraphQL endpoints you want to target.

```typescript
import { Bridge } from "@zeko-labs/bridge-sdk"

const bridge = await Bridge.init({
	l1Url: "https://gateway.mina.devnet.zeko.io",
	l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
	zekoUrl: "https://testnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql",
	actionsApi: "https://testnet.api.actions.zeko.io/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
})
```

The endpoints above are testnet examples. Use the matching mainnet endpoints for production traffic.

## Operational Notes

- Archive action history is most reliable when queried in recent `10_000`-block windows. Giant full-history scans starting from block `0` are a poor fit for manual diagnostics.
- Withdrawal finalization depends on the L2 archive/indexer/actions-api path catching up to the live sequencer action. A live withdrawal may appear on the sequencer before it is witnessable through the archive-backed path.
- Sequencer proof requests currently live in memory for about 20 minutes. If a prove/finalize request sits longer than that, later polling may return `Invalid key`. That case is currently terminal and not yet automatically recoverable.
- Deposits obey two important protocol rules:
  - a cancellable deposit can never later be finalized
  - cancellable deposits are skippable, but finalizable deposits must never be skipped
- Deposit queue progression depends on protocol state:
  - `lastFinalizedDeposit` on L2
  - `lastCancelledDeposit` on L1
  - only deposit indices strictly above those state values may be claimed
- The bridge-cli is expected to satisfy an unattended contract on top of this SDK: one command starts the bridge, the process may wait a long time, and the same operation should later be found completed without manual babysitting.

## Usage

### Submit a Deposit

```typescript
import { PrivateKey, UInt32, UInt64 } from "o1js"

const signer = PrivateKey.fromBase58(process.env.MINA_PRIVATE_KEY!)
const recipient = signer.toPublicKey()

const transaction = await bridge.submitDeposit(
	{ sender: recipient, fee: 0.1 * 10e8 },
	{
		recipient,
		amount: UInt64.from(10 * 10e8),
		timeout: UInt32.MAXINT(),
		holderAccountL1: bridge.outerHolders[0]
	}
)

await transaction.sign([signer]).send()
```

### Submit a Withdrawal

```typescript
const transaction = await bridge.submitWithdrawal(
	{ sender: recipient, fee: 0.1 * 10e8 },
	{
		recipient,
		amount: UInt64.from(5 * 10e8)
	}
)

await transaction.sign([signer]).send()
```

### Finalize Operations

```typescript
await bridge.finalizeDeposit(recipient)

await bridge.finalizeWithdrawal(
	recipient,
	{ sender: recipient, fee: 0.1 * 10e8 },
	bridge.outerHolders[0]
)
```

Finalization time depends on the size of the witness data the bridge must prove. Longer gaps between submission and finalization generally mean more proof work and slower completion.

### Canonical Ethereum ERC-20

An Ethereum-enabled sequencer can expose a shared immutable ERC-20 registry. The SDK authenticates
the registry root, count, and schema from the runtime, verifies each selected record's depth-8
Poseidon membership, and binds the encoding version, registry index, and record commitment into V2
deposit and withdrawal actions. `bridge.ethereumAssets` exposes the authenticated checkpoint,
registry and registration-authority public keys, the registry verification-key hash, the universal
bridge verification-key identifier and hash, and the approved Mina FungibleToken identifiers and
hashes.

Indexed lookups are accepted only when the snapshot matches that runtime checkpoint and every
record and path recomputes the authenticated root. Returned assets preserve
`checkpointFinality` and `registrationFinality` as `pending` or `canonical`; neither status is
hidden from finalization-oriented lookup. Registration is governed: the transaction fee payer must
be `bridge.ethereumAssets.registrationAuthority`, and the proof must contain that authority's
exact full-commitment signed child update.

Legacy V1 runtime configuration and action decoding remain available through
`bridge.ethereumToken`; universal runtimes resolve assets with `bridge.fetchEthereumAsset`. When a
runtime exposes both configurations, deposit finalization must include the deposit's original
encoding version and asset selector so V1 and V2 actions cannot be confused.

The SDK's `finalizeEthereumTokenDeposit` and `submitEthereumTokenWithdrawal` methods request the
asset proof, verify the returned forest, compose it with the unmodified `mina-fungible-token`
owner's `approveBase` proof, and submit the complete L2 transaction. The withdrawal request binds
the complete token-owner account-update body, so the sequencer proof cannot be reused under a
different standard-token approval.

Operators can deploy and provision the matching L2 mirror with `deployEthereumTokenMirror`:

```typescript
import { deployEthereumTokenMirror } from "@zeko-labs/bridge-sdk"

bridge.setL2()
const { config } = await bridge.fetchEthereumAsset({
	ethereumTokenAddress
})

const manifest = await deployEthereumTokenMirror({
	config,
	registration, // Read with EthereumBridgeClient.getTokenRegistration(token).
	bridgeVerificationKey, // The shared universal bridge VK.
	decimals: registration.zekoDecimals,
	inventory: registration.depositCap,
	feePayer,
	adminContractL2, // Bootstrap admin used only for the exact inventory mint.
	adminAuthorityL2,
	finalAdminContractL2, // Stock admin whose authority is PublicKey.empty().
	symbol: "zERC",
	sourceUri: "https://example.invalid/contracts/zerc20",
	allowUpdates: false,
	signDeployment,
	signProvisioning
})
```

The helper rejects registry, owner, derived token ID, asset ID, address, decimal, cap, inventory,
or bridge-VK mismatches before submission. It deploys the stock `FungibleToken` and bootstrap
`FungibleTokenAdmin`, installs a separate proof-controlled vault, mints exactly the registered
Solidity deposit cap, then rotates the token to a second stock admin controlled by
`PublicKey.empty()`. The returned manifest includes both admin identities and the rotation
transaction hash. Multiple registered ERC-20s share the universal bridge circuit and verification
key while retaining separate token owners and immutable registry records.

## Development

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

Run all commands from the monorepo root with Moon:

```bash
moon run bridge-sdk:build
moon run bridge-sdk:typecheck
```

This schema refresh command is not available in the standalone bridge-sdk mirror.

This schema refresh command is not available in the standalone bridge-sdk mirror.

This schema refresh command is not available in the standalone bridge-sdk mirror.

To refresh the generated GraphQL schema types used by the package:

```bash
moon run graphql:schema-get
```

## Local Examples

The repository includes example scripts in `packages/bridge-sdk/examples`. From the monorepo root:

```bash
moon run bridge-sdk:submitDeposit
moon run bridge-sdk:finalizeDeposit
moon run bridge-sdk:submitWithdrawal
moon run bridge-sdk:finalizeWithdrawal
moon run bridge-sdk:fetchOuterActions
moon run bridge-sdk:fetchInnerActions
```

## License

MIT
