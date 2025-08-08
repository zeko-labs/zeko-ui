# Zeko Bridge SDK

A TypeScript SDK for interacting with the Zeko bridge, enabling deposits and withdrawals between Mina (L1) and Zeko (L2).

## Installation

You will need `pnpm` and `bun` installed to run this project.

```bash
pnpm install
```

## Build

You can build the libraries with tsdown :

```bash
bun run build
```

## Development

### Graphql

The library uses `gql.tada` to generate types from the GraphQL schema. You can run the following command to download the latest schema and generate types:

```bash
bun run schema:get
```

If the queries in the `src/queries` are out of sync with the schema, there will be a typescript error.

## Usage

### Initialize the Bridge

```typescript
import { Bridge } from "bridge-sdk"

const bridge = await Bridge.init({
	l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
	l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
	zekoUrl: "https://alphanet.zeko.io/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
})
```

### Submit a Deposit

```typescript
import { PrivateKey, UInt32, UInt64 } from "o1js"

const signer = PrivateKey.fromBase58(process.env.MINA_PRIVATE_KEY)
const recipient = signer.toPublicKey()

const txn = await bridge.submitDeposit(
	{ sender: recipient, fee: 0.1 * 10e8 },
	{
		recipient,
		amount: UInt64.from(10 * 10e8),
		timeout: UInt32.MAXINT(),
		holderAccountL1: bridge.outerHolders[0]
	}
)

const result = await txn.sign([signer]).send()
```

### Submit a Withdrawal

```typescript
const txn = await bridge.submitWithdrawal(
	{ sender: recipient, fee: 0.1 * 10e8 },
	{
		recipient,
		amount: UInt64.from(5 * 10e8)
	}
)

const result = await txn.sign([signer]).send()
```

### Finalize Operations

```typescript
// Finalize a deposit
await bridge.finalizeDeposit(recipient)

// Finalize a withdrawal
await bridge.finalizeWithdrawal(
	recipient,
	{ sender: recipient, fee: 0.1 * 10e8 },
	bridge.outerHolders[0]
)
```

## Examples

Set your wallet private key in the `.env` file.
Run the example scripts:

```bash
# Make sure that you have at least 10 MINA on L1.
bun run submitDeposit 
# You will have to wait until the deposit went through on L1
bun run finalizeDeposit
# Nothing to note here
bun run submitWithdrawal
# You will have to wait until the withdrawal is synced
bun run finalizeWithdrawal
bun run fetchOuterActions
bun run fetchInnerActions
```

## License

MIT
