# Bridge SDK

A TypeScript SDK for interacting with the Zeko bridge, enabling deposits and withdrawals between Mina (L1) and Zeko (L2).

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

### Initialize the Bridge

```typescript
import { Bridge } from "bridge-sdk"

const bridge = await Bridge.init({
	l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
	l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
	zekoUrl: "https://testnet.zeko.io/graphql",
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

Run the example scripts:

```bash
npm run submitDeposit
npm run finalizeDeposit
npm run submitWithdrawal
npm run finalizeWithdrawal
npm run fetchOuterActions
npm run fetchInnerActions
```

## Development

```bash
npm run dev      # Watch mode
```

## License

MIT
