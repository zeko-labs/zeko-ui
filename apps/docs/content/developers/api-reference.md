# API Reference

:::warning
WIP: This section is under construction.
:::

Find API documentation for Zeko SDKs, smart contracts, and developer tools here.

## Available APIs & SDKs

### Zeko Bridge SDK

The **Zeko Bridge SDK** is a TypeScript SDK for interacting with the Zeko bridge, enabling deposits and withdrawals between Mina (L1) and Zeko (L2).

**Installation:**
```bash
pnpm install bridge-sdk
```

**Key Features:**
- Submit deposits from Mina L1 to Zeko L2
- Submit withdrawals from Zeko L2 to Mina L1
- Finalize bridge operations
- TypeScript support with full type safety

**Quick Example:**
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

[View Bridge SDK Documentation](../../bridge-sdk/)

### Lumina SDK

The **Lumina SDK** simplifies integration of LuminaDex contracts for building DEX functionality on Zeko.

- **[SDK Documentation](https://sdk.luminadex.com/)**
- **[GitHub Repository](https://github.com/Lumina-DEX/lumina)**
- **[Live Example](https://lumina-devnet.netlify.app/)**

### GraphQL APIs

**Zeko Network GraphQL Endpoint:**
- **Testnet:** `https://alphanet.zeko.io/graphql`

**Mina Network GraphQL Endpoints:**
- **Devnet:** `https://api.minascan.io/node/devnet/v1/graphql`
- **Archive:** `https://api.minascan.io/archive/devnet/v1/graphql`

### o1js Framework

For smart contract development, Zeko uses the **o1js** framework:

- **[o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)**
- **[o1js GitHub](https://github.com/o1-labs/o1js)**
- **[zkApp CLI](https://github.com/o1-labs/zkapp-cli)**

## Developer Tools

### Explorers & Monitoring

- **[ZekoScan Testnet Explorer](https://zekoscan.io/testnet/home)** - Explore Zeko testnet transactions and blocks
- **[MinaScan Explorer](https://minascan.io/mainnet/home)** - Explore Mina network activity

### Wallet Integration

- **Auro Wallet:** Browser extension v2.4.1+ or mobile app v2.2.0+ required for Zeko compatibility

### Network Endpoints

For development and testing, you can connect to:
- **Zeko Testnet:** `https://alphanet.zeko.io`
- **Zeko Faucet:** `https://zeko.io/faucet`
- **Zeko Bridge:** `https://zeko.io/bridge`
