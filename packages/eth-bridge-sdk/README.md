# `@zeko-labs/eth-bridge-sdk`

Browser-facing client for the native Ethereum bridge PoC. It owns Ethereum wallet calls and
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

Pass the optional `zeko` configuration to enable `prepareDepositFinalization`,
`finalizeDeposit`, and `requestWithdrawal`. Ethereum deposits and withdrawal claims only need
the gateway and EIP-1193 wallet provider. Operator proof endpoints and credentials are not part
of this package.

The four user operations are split by execution environment:

| Flow step               | Client call             | Submitted to             |
| ----------------------- | ----------------------- | ------------------------ |
| Deposit request         | `depositNative`         | Ethereum bridge          |
| Deposit finalization    | `finalizeDeposit`       | Zeko sequencer proof API |
| Withdrawal request      | `requestWithdrawal`     | Zeko sequencer proof API |
| Withdrawal finalization | `claimNativeWithdrawal` | Ethereum bridge          |

Use `listDeposits`/`waitForDeposit` and `listWithdrawals` after reloads. Amounts returned by the
gateway are decimal strings so callers can convert them to `bigint` without losing `uint64`
precision. `requestWithdrawal` accepts separate `sender` and Ethereum destination values; the
sender signs and funds the L2 debit while the synthetic Zeko public key encodes the destination.
