# User Concepts Explained

_This section helps end users understand some key concepts when interacting with the Zeko network._

#### Testnet vs Mainnet

Zeko's architecture is **mostly isomorphic to Mina**. This means the experience of using Zeko on a test network (like devnet) is **analogous** to using Mina's own testnet compared to its Mainnet.

- **Testnets** (like Zeko-M testnet and alphanet) are environments provided for developers and users to **test applications and features** in a setting that mimics the Mainnet, but without using real-world value. They often have faucets to obtain free test tokens, for example, the faucet on `https://zeko.io/faucet` is for the Zeko-M testnet instance.
- **Mainnet** will be the primary, live Zeko network where transactions involve real value.

Starting out on a testnet like Zeko-M testnet is recommended to become familiar with the network and its interactions before using the Mainnet.

#### Understanding Transaction Fees

When you perform transactions or interact with zkApps on Zeko, you will incur fees. These fees play a crucial role in the network's operation and are typically paid to the **sequencer**.

Key points about Zeko transaction fees:

- Fees on Zeko are cheaper than equivalent complex transactions on Layer 1 Mina, aiming to improve the economics of using zkApps.
- The amount of the fee for Layer 2 transactions is related to the **complexity of the circuit/computation** involved in the transaction. There's an upper limit on how much complexity can be included in a batch, which limits the number of account updates per batch.
- For cross-layer operations like bridging assets from L1 to L2 (deposits), the fees can be potentially higher due to the requirement for an L1 inclusion proof pool.
- Fees are charged in **L1 tokens** (MINA).
- Fees cover various aspects of the ZK Rollup operation, including data availability storage, batch creation, proof aggregation, and posting the batch to Layer 1.

:::warning
Creating a new account on Mina and on Zeko also involves paying an account creation fee of 0.1 MINA (or 0.1 tMINA on testnets).
:::

Zeko aims to make the fee structure competitive within the wider rollup space.
