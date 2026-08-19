# `@zeko-labs/eth-bridge-sdk`

Browser-facing client for the native and canonical ERC-20 Ethereum bridge. It owns Ethereum wallet calls and
gateway discovery while reusing `@zeko-labs/bridge-sdk` for Zeko transaction preparation,
signing, and sequencer proof requests.

```ts
import { EthereumBridgeClient } from "@zeko-labs/eth-bridge-sdk"
import { PublicKey } from "o1js"

const bridge = await EthereumBridgeClient.init({
	gatewayUrl: "https://ethereum-gateway.example",
	provider: window.ethereum,
	expectedChainId: 11155111
})

const deposit = await bridge.depositNative({
	recipient: PublicKey.fromBase58("B62..."),
	valueWei: 1_000_000_000_000_000_000n
})

console.log(deposit.nonce, deposit.deposit.status)
```

After approving the bridge contract to spend the ERC-20, submit an asset-bound deposit with
the token's unscaled base-unit amount:

```ts
const deposit = await bridge.depositToken({
	token: "0x...",
	recipient: PublicKey.fromBase58("B62..."),
	amount: 2_000_000n
})
```

Operators propose the canonical record on Ethereum, register that exact record on Zeko, then
activate the pending Solidity proposal only after its proof-backed registry batch settles. The
Zeko fee payer and transaction signer must be the runtime's configured registration authority:

```ts
await bridge.proposeAsset(record)

await bridge.registerAssetRecord({
	record,
	feePayer: { sender: registrationAuthority, fee: 2_500 },
	signTransaction
})

const registration = await bridge.getTokenRegistration(
	record.ethereumTokenAddress
)
await bridge.activateAssetFromBatch({
	token: record.ethereumTokenAddress,
	settlementSequence,
	batchRecords
})
```

The `2_500`-nanounit example is the Ethereum-backed Sepolia transaction fee;
applications should supply the fee from their deployed runtime configuration.

Every supplied snapshot is checked by rebuilding its depth-8 Poseidon tree and verifying every
membership path. With the optional Zeko configuration, initialization additionally authenticates
the root, count, schema, and shared MFT, vault, and bridge identities against the current runtime.
`getZekoAsset` resolves the latest immutable record by Ethereum token and retains separate
`checkpointFinality` and `registrationFinality` values for pending and canonical visibility.
`bridge.assetRegistry` also resolves by asset ID or stable registry index; `refreshAssetRegistry`
authenticates later append-only snapshots and refreshes existing paths.
`ethereumAssetRecordBatchMembership` constructs the separate depth-8 Keccak proof used only at the
OCaml/SP1/Solidity activation seam.

Pass the optional `zeko` configuration to enable `prepareDepositFinalization`,
`finalizeDeposit`, and `requestWithdrawal`. Ethereum deposits and withdrawal claims only need
the gateway and EIP-1193 wallet provider. Operator proof endpoints and credentials are not part
of this package.

The four user operations are split by execution environment:

| Flow step               | Client call                                      | Submitted to             |
| ----------------------- | ------------------------------------------------ | ------------------------ |
| Deposit request         | `depositNative` / `depositToken`                 | Ethereum bridge          |
| Deposit finalization    | `finalizeDeposit` / `finalizeTokenDeposit`       | Zeko sequencer proof API |
| Withdrawal request      | `requestWithdrawal` / `requestTokenWithdrawal`   | Zeko sequencer proof API |
| Withdrawal finalization | `claimNativeWithdrawal` / `claimTokenWithdrawal` | Ethereum bridge          |

Use `listDeposits`/`waitForDeposit` and `listWithdrawals` after reloads. Amounts returned by the
gateway are decimal strings so callers can convert them to `bigint` without losing `uint64`
precision. `requestWithdrawal` accepts separate `sender` and Ethereum destination values; the
sender signs and funds the L2 debit while the synthetic Zeko public key encodes the destination.
Use `getTokenWithdrawal` for an asset-bound token proof. The token-specific L2 methods compose the
Zeko vault proof with the unmodified Mina `FungibleToken.approveBase` proof before submission.
